declare const Chart: any;

// Creates and renders a pie chart displaying the wins versus losses statistics
// Destroys any existing chart instance before creating a new one to prevent memory leaks
export function initializeStatsChart(wins: number, losses: number)
{
    const canvas = document.getElementById('stats-chart') as HTMLCanvasElement;
    
    if (!canvas)
        return;

    const ctx = canvas.getContext('2d');
    
    if (!ctx)
        return;

    // Remove the previous chart instance if it exists to avoid conflicts
    if (Chart && Chart.getChart)
    {
        const existingChart = Chart.getChart(canvas);
        
        if (existingChart)
            existingChart.destroy();
    }

    if (!Chart)
        return;

    // Configure and render the pie chart with wins and losses data
    new Chart(ctx,
    {
        type: 'pie',
        data:
        {
            labels: ['Wins', 'Losses'],
            datasets: [{
                data: [wins, losses],
                backgroundColor: [
                    'rgba(255, 255, 255, 0.8)',
                    'rgba(0, 0, 0, 0.8)',
                ],
                borderColor: [
                    'rgba(255, 255, 255, 1)',
                    'rgba(0, 0, 0, 1)',
                ],
                borderWidth: 2
            }]
        },
        options:
        {
            responsive: true,
            maintainAspectRatio: true,
            plugins:
            {
                legend:
                {
                    display: false
                },
                tooltip:
                {
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

// Fetches match history and generates a line chart showing win rate progression over time
// Uses dynamic grouping to keep the chart readable when there are many matches
export async function initializeWinRateHistoryChart(userId: string)
{
    const canvas = document.getElementById('winrate-history-chart') as HTMLCanvasElement;
    
    if (!canvas)
        return;

    try
    {
        // Retrieve all match records for this user from the server
        const response = await fetch(`/matches/history/${userId}`);
        
        if (!response.ok)
            return;
        
        const data = await response.json();
        const matches = data.matches || [];
        
        // Order matches chronologically from oldest to newest for accurate progression
        matches.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Process matches to calculate win rate at each point in time
        const winRateData = calculateProgressiveWinRate(matches, userId);
        
        const ctx = canvas.getContext('2d');
        
        if (!ctx)
            return;

        // Remove the previous chart instance if it exists
        if (Chart && Chart.getChart)
        {
            const existingChart = Chart.getChart(canvas);
            
            if (existingChart)
                existingChart.destroy();
        }

        if (!Chart)
            return;

        // Configure and render the line chart showing win rate evolution
        new Chart(ctx,
        {
            type: 'line',
            data:
            {
                labels: winRateData.labels,
                datasets: [{
                    label: 'Win Rate %',
                    data: winRateData.data,
                    borderColor: 'rgba(251, 191, 36, 1)',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options:
            {
                responsive: true,
                maintainAspectRatio: false,
                scales:
                {
                    y:
                    {
                        beginAtZero: true,
                        max: 100,
                        ticks:
                        {
                            color: '#fff',
                            callback: function(value: any)
                            {
                                return value + '%';
                            }
                        },
                        grid:
                        {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x:
                    {
                        ticks:
                        {
                            color: '#fff'
                        },
                        grid:
                        {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins:
                {
                    legend:
                    {
                        display: false
                    },
                    tooltip:
                    {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#fbbf24',
                        borderWidth: 1,
                        callbacks:
                        {
                            label: function(context: any)
                            {
                                return 'Win Rate: ' + context.parsed.y.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    catch (error)
    {
    }
}

// Processes match history to calculate win rate progression with adaptive grouping
// Groups matches together when the total count is high to keep the chart readable
function calculateProgressiveWinRate(matches: any[], userId: string)
{
    const labels: string[] = [];
    const data: number[] = [];
    
    let wins = 0;
    let totalGames = 0;
    let groupSize = 1;
    let gamesInCurrentGroup = 0;
    let winsInCurrentGroup = 0;
    const maxPointsOnChart = 50;
    
    // Iterate through each match to build the progressive win rate data
    matches.forEach((match: any) =>
    {
        const isWin = match.winner_id === userId;
        totalGames++;
        
        if (isWin)
        {
            wins++;
            winsInCurrentGroup++;
        }
        
        gamesInCurrentGroup++;
        
        // Add a data point when the current group reaches the target size
        if (gamesInCurrentGroup >= groupSize)
        {
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
            labels.push(`${totalGames}`);
            data.push(winRate);
            
            gamesInCurrentGroup = 0;
            winsInCurrentGroup = 0;
            
            // Double the group size when approaching the maximum point limit to maintain readability
            if (data.length >= maxPointsOnChart && groupSize < 64)
                groupSize *= 2;
        }
    });
    
    // Add the final data point if there are remaining ungrouped matches
    if (gamesInCurrentGroup > 0)
    {
        const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
        labels.push(`${totalGames}`);
        data.push(winRate);
    }
    
    return { labels, data };
}