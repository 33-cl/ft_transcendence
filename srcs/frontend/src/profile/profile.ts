// Chart.js est chargé via CDN dans index.html
declare const Chart: any;

export function initializeStatsChart(wins: number, losses: number) {
    const canvas = document.getElementById('stats-chart') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas stats-chart not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2d context');
        return;
    }

    // Détruire l'ancien graphique s'il existe
    if (Chart && Chart.getChart) {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
    }

    if (!Chart) {
        console.error('Chart.js not loaded');
        return;
    }

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Wins', 'Losses'],
            datasets: [{
                data: [wins, losses],
                backgroundColor: [
                    'rgba(255, 255, 255, 0.8)',  // green-500
                    'rgba(0, 0, 0, 0.8)',  // red-500
                ],
                borderColor: [
                    'rgba(255, 255, 255, 1)',
                    'rgba(0, 0, 0, 1)',
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fbbf24',
                    borderWidth: 1
                }
            }
        }
    });
    
    console.log('Stats chart initialized with wins:', wins, 'losses:', losses);
}

export async function initializeWinRateHistoryChart(userId: string) {
    const canvas = document.getElementById('winrate-history-chart') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas winrate-history-chart not found');
        return;
    }

    // Récupérer tous les matchs de l'utilisateur
    try {
        const response = await fetch(`/matches/history/${userId}`);
        if (!response.ok) {
            console.error('Failed to fetch match history');
            return;
        }
        
        const data = await response.json();
        const matches = data.matches || [];
        
        if (matches.length === 0) {
            console.log('No matches found for win rate history');
            return;
        }
        
        // Trier les matchs par date (du plus ancien au plus récent)
        matches.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Calculer le win rate progressif avec regroupement dynamique
        const winRateData = calculateProgressiveWinRate(matches, userId);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2d context');
            return;
        }

        // Détruire l'ancien graphique s'il existe
        if (Chart && Chart.getChart) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }

        if (!Chart) {
            console.error('Chart.js not loaded');
            return;
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: winRateData.labels,
                datasets: [{
                    label: 'Win Rate %',
                    data: winRateData.data,
                    borderColor: 'rgba(251, 191, 36, 1)',  // amber-500
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#fff',
                            callback: function(value: any) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#fbbf24',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context: any) {
                                return 'Win Rate: ' + context.parsed.y.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Win rate history chart initialized with', matches.length, 'matches');
    } catch (error) {
        console.error('Error initializing win rate history chart:', error);
    }
}

function calculateProgressiveWinRate(matches: any[], userId: string) {
    const labels: string[] = [];
    const data: number[] = [];
    
    let wins = 0;
    let totalGames = 0;
    let groupSize = 1;  // Commence avec 1 game par point
    let gamesInCurrentGroup = 0;
    let winsInCurrentGroup = 0;
    const maxPointsOnChart = 50;  // Nombre maximum de points sur le graphique
    
    matches.forEach((match: any) => {
        const isWin = match.winner_id === userId;
        totalGames++;
        if (isWin) {
            wins++;
            winsInCurrentGroup++;
        }
        gamesInCurrentGroup++;
        
        // Quand on atteint la taille du groupe, on ajoute un point
        if (gamesInCurrentGroup >= groupSize) {
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
            labels.push(`${totalGames}`);
            data.push(winRate);
            
            gamesInCurrentGroup = 0;
            winsInCurrentGroup = 0;
            
            // Doubler la taille du groupe quand on a trop de points
            if (data.length >= maxPointsOnChart && groupSize < 64) {
                groupSize *= 2;
            }
        }
    });
    
    // Ajouter le dernier point s'il reste des games
    if (gamesInCurrentGroup > 0) {
        const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
        labels.push(`${totalGames}`);
        data.push(winRate);
    }
    
    return { labels, data };
}
