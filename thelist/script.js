var itemList = [
    { name: 'Realistic Sans', count: 25 },
    { name: 'Barbarian', count: 18 },
    { name: 'PvZ Zombie', count: 5 },
    { name: 'Hooty', count: 2 },
    { name: 'Papyrus', count: 4 },
    { name: 'Mr Meeseeks', count: 7 }
  ];

// Get the element where the item list will be displayed
var itemListElement = document.getElementById('item-list');

// Function to generate HTML for each item
function generateItemHTML(item) {
  var itemHTML = '<div class="item-card">' +
                 '<a href="' + item.name.toLowerCase().replace(/\s/g, '-') + '.html">' +
                 '<h3>' + item.name + '</h3>' +
                 '<p>Count: <span class="item-count">' + item.count + '</span></p>' +
                 '</a>' +
                 '</div>';
  return itemHTML;
}

// Generate HTML for each item and append it to the item list element
for (var i = 0; i < itemList.length; i++) {
  var item = itemList[i];
  var itemHTML = generateItemHTML(item);
  itemListElement.innerHTML += itemHTML;
}