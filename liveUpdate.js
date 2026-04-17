// Code to refresh the updates every 7 hours
function scheduleLiveUpdate() {
    setInterval(() => {
        refreshData();
    }, 7 * 60 * 60 * 1000);
}

function refreshData() {
    // Logic to fetch data from public/survey/*.json
    // Update the UI accordingly
}

scheduleLiveUpdate();