document.addEventListener('DOMContentLoaded', function() {
    const stanceForm = document.getElementById('stanceForm');
    const submitPanel = document.getElementById('submitPanel');
    const glossaryPanel = document.getElementById('glossaryPanel');
    const entriesList = document.getElementById('entriesList');

    stanceForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(stanceForm);
        const entry = formData.get('entry');

        // Parse category from input
        const categoryMatch = entry.match(/^(?<category>\S+): (?<text>.+)$/) || entry.match(/^(?:#|)(?<category>\S+) (?<text>.+)$/);

        if (categoryMatch && categoryMatch.groups) {
            const category = categoryMatch.groups.category;
            const text = categoryMatch.groups.text;

            // Store entry in localStorage
            let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
            if (!artEntries[category]) {
                artEntries[category] = [];
            }
            artEntries[category].push(text);
            localStorage.setItem('artEntries', JSON.stringify(artEntries));

            // Update glossary display
            displayGlossary();

            // Hide submit panel and show glossary panel
            submitPanel.style.display = 'none';
            glossaryPanel.style.display = 'block';
        } else {
            console.error('Invalid input format. Please use "category: text" or "#category text".');
        }
    });

    function displayGlossary() {
        entriesList.innerHTML = ''; // Clear previous entries
        let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
        for (const category in artEntries) {
            const categoryPanel = document.createElement('div');
            categoryPanel.className = 'category-panel';
            const header = document.createElement('h3');
            header.innerText = category;
            categoryPanel.appendChild(header);

            artEntries[category].forEach(entry => {
                const entryItem = document.createElement('div');
                entryItem.innerText = entry;
                categoryPanel.appendChild(entryItem);
            });
            entriesList.appendChild(categoryPanel);
        }
    }

    // Poll every 4 seconds for updates
    setInterval(displayGlossary, 4000);
});
