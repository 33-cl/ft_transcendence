import { MatchData } from './gamestats.html.js';

// Chart.js is loaded via CDN in index.html
declare const Chart: any;

// Init the points distribution chart
export function initializePointsDistributionChart(match: MatchData): void {
    const canvas = document.getElementById('points-distribution-chart') as HTMLCanvasElement;
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    // Destroy the old chart if it exists
    if (Chart && Chart.getChart) {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
    }

    if (!Chart) {
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [match.winner_username, match.loser_username],
            datasets: [{
                data: [match.winner_score, match.loser_score],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)', 
                    'rgba(239, 68, 68, 0.8)',
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(239, 68, 68, 1)',
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 14
                        }
                    }
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
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} points (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Init the score progression chart
export function initializeScoreProgressionChart(match: MatchData): void
{
    const canvas = document.getElementById('score-progression-chart') as HTMLCanvasElement;
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    // Destroy the old chart if it exists
    if (Chart && Chart.getChart) {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
    }

    if (!Chart) {
        return;
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [match.winner_username, match.loser_username],
            datasets: [{
                label: 'Points Scored',
                data: [match.winner_score, match.loser_score],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',  // green pour le gagnant
                    'rgba(239, 68, 68, 0.8)',  // red pour le perdant
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(239, 68, 68, 1)',
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(match.winner_score, match.loser_score) + 2,
                    ticks: {
                        color: '#fff',
                        stepSize: 1
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
                        display: false
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
                    borderWidth: 1
                }
            }
        }
    });
}

// Itialize both charts
export function initializeGameStatsCharts(match: MatchData): void {
    if (!match) {
        console.warn('No match data provided for charts');
        return;
    }
    initializePointsDistributionChart(match);
    initializeScoreProgressionChart(match);
}
