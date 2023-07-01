// Create an object to hold the item data
var Item = function(name, count, image, description) {
  this.name = name;
  this.count = count;
  this.image = image;
  this.description = description;
};

// Define the itemList array with item objects
var itemList = [
  new Item('Realistic Sans', 25, 'path/to/realistic-sans-image.jpg', 'Description of Realistic Sans'),
  new Item('Barbarian', 18, 'path/to/barbarian-image.jpg', 'Description of Barbarian')
  // Add other items here
];

// Get the item list element
var itemListElement = document.getElementById('item-list');

// Display the list of items on the index.html page
function displayItemList() {
  itemListElement.innerHTML = '';

  for (var i = 0; i < itemList.length; i++) {
    var item = itemList[i];

    var itemCard = document.createElement('div');
    itemCard.classList.add('item-card');

    var itemName = document.createElement('a');
    itemName.textContent = item.name;
    itemName.href = 'item.html#' + encodeURIComponent(item.name);

    var itemCount = document.createElement('p');
    itemCount.textContent = 'Count: ' + item.count;

    itemCard.appendChild(itemName);
    itemCard.appendChild(itemCount);
    itemListElement.appendChild(itemCard);
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
  var itemCountElement = document.getElementById('item-count');
  var itemImageElement = document.getElementById('item-image');
  var itemDescriptionElement = document.getElementById('item-description');

  itemNameElement.textContent = item.name;
  itemCountElement.textContent = 'Count: ' + item.count;
  itemImageElement.src = item.image;
  itemDescriptionElement.textContent = item.description;
}

// Load the item content based on the URL hash
function loadItemContent() {
  var itemHash = window.location.hash.substr(1);
  var itemName = decodeURIComponent(itemHash);

  var item = findItemByName(itemName);
  if (item) {
    updateItemPage(item);
  } else {
    // Handle invalid or non-existing item names
    console.log('Item not found: ' + itemName);
  }
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();

// Check if the page is an item page and load the item content if necessary
if (window.location.pathname.includes('/thelist/item.html')) {
  loadItemContent();
}