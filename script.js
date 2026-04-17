document.addEventListener('DOMContentLoaded', function() {
    const stanceForm = document.getElementById('stanceForm');
    const submitPanel = document.getElementById('submitPanel');
    const glossaryPanel = document.getElementById('glossaryPanel');
    const inputField = document.getElementById('inputField');
    const market = document.getElementById('market');

    // Handle form submission
    stanceForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const entry = inputField.value.trim();

        if (!entry) return;

        // Parse category: "design: text" or "#design text"
        const categoryMatch = entry.match(/^(?<category>\S+):\s*(?<text>.+)$/) || 
                            entry.match(/^#(?<category>\S+)\s+(?<text>.+)$/);

        if (categoryMatch && categoryMatch.groups) {
            const category = categoryMatch.groups.category;
            const text = categoryMatch.groups.text;

            // Store in localStorage
            let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
            if (!artEntries[category]) {
                artEntries[category] = [];
            }
            artEntries[category].push({text, timestamp: new Date().toLocaleTimeString()});
            localStorage.setItem('artEntries', JSON.stringify(artEntries));

            // Clear input
            inputField.value = '';

            // Switch to glossary
            submitPanel.classList.add('isHidden');
            glossaryPanel.classList.remove('isHidden');
            displayGlossary();
        }
    });

    function displayGlossary() {
        market.innerHTML = '';
        let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
        
        for (const category in artEntries) {
            const term = document.createElement('div');
            term.className = 'term';
            
            const termHead = document.createElement('div');
            termHead.className = 'termHead';
            termHead.innerHTML = `
                <span class="ch">${category}</span>
                <span class="count">${artEntries[category].length} entries</span>
            `;
            term.appendChild(termHead);

            const cols = document.createElement('div');
            cols.className = 'cols';
            cols.innerHTML = `<div>Time</div><div>Entry</div>`;
            term.appendChild(cols);

            const rows = document.createElement('div');
            rows.className = 'rows';
            
            artEntries[category].forEach((entry, index) => {
                const rowItem = document.createElement('div');
                rowItem.className = 'rowItem';
                if (index === artEntries[category].length - 1) {
                    rowItem.classList.add('isNew');
                }
                rowItem.innerHTML = `
                    <div class="ts">${entry.timestamp}</div>
                    <div class="msg">${entry.text}</div>
                `;
                rows.appendChild(rowItem);
            });
            
            term.appendChild(rows);
            market.appendChild(term);
        }
    }

    // Poll every 4 seconds
    setInterval(displayGlossary, 4000);
});
