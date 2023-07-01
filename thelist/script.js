var itemList = [
  {
    name: 'Realistic Sans',
    count: 25,
    image: 'path/to/realistic-sans-image.jpg',
    description: 'Description of Realistic Sans'
  },
  // Add other items here
];

// Get the item list element and attach a click event listener
var itemListElement = document.getElementById('item-list');
itemListElement.addEventListener('click', onItemClick);

// Event handler for item click
function onItemClick(event) {
  event.preventDefault();

  var target = event.target;
  if (target.tagName === 'A') {
    var item = findItemByName(target.textContent.trim());
    if (item) {
      // Construct the URL for the individual item page dynamically
      var itemPageURL = 'item.html' + '#' + encodeURIComponent(item.name);
      window.location.href = itemPageURL;
    }
  }
}

// Find an item in the itemList array by its name
function findItemByName(name) {
  for (var i = 0; i < itemList.length; i++) {
    if (itemList[i].name === name) {
      return itemList[i];
    }
  }
  return null;
}

// Update the item page with the content of the selected item
function updateItemPage(item) {
  var itemNameElement = document.getElementById('item-name');
  var itemImageElement = document.getElementById('item-image');
  var itemDescriptionElement = document.getElementById('item-description');

  itemNameElement.textContent = item.name;
  itemImageElement.src = item.image;
  itemDescriptionElement.textContent = item.description;
}

// Display the list of items
function displayItemList() {
  var itemListElement = document.getElementById('item-list');
  itemListElement.innerHTML = '';

  for (var i = 0; i < itemList.length; i++) {
    var item = itemList[i];
    var itemCard = document.createElement('div');
    itemCard.classList.add('item-card');

    var itemName = document.createElement('a');
    itemName.textContent = item.name;
    itemName.href = 'item.html#' + encodeURIComponent(item.name);

    itemCard.appendChild(itemName);
    itemListElement.appendChild(itemCard);
  }
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();