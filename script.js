async function init() {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase did not load in time')), 5000));
    const supabaseReady = () => new Promise((resolve) => {
        const checkSupabase = setInterval(() => {
            if (window.supabase) {
                clearInterval(checkSupabase);
                resolve(window.supabase);
            }
        }, 100);
    });

    try {
        await Promise.race([supabaseReady(), timeout]);
        // Show loading status to user
        document.body.innerHTML += '<p>Loading Supabase...</p>';

        // Initialize Supabase client
        const supabase = window.supabase;
        // Existing logic here, e.g., form submission, polling, glossary, etc.

    } catch (error) {
        console.error(error);
        document.body.innerHTML += '<p>Error loading Supabase: ' + error.message + '</p>';
    }
}

init();