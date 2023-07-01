// Create an object to hold the item data
var Item = function(name, count, image, description) {
  this.name = name;
  this.count = count;
  this.image = image;
  this.description = description;
};

// Define the itemList array with item objects
var itemList = getItemListFromLocalStorage() || [
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

    var editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', createEditItemHandler(item));

    var deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', createDeleteItemHandler(item));

    itemCard.appendChild(itemName);
    itemCard.appendChild(itemCount);
    itemCard.appendChild(editButton);
    itemCard.appendChild(deleteButton);
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

// Create a click event handler for editing an item
function createEditItemHandler(item) {
  return function () {
    // Redirect to the edit.html page with the item's details pre-filled
    window.location.href = 'edit.html#' + encodeURIComponent(item.name);
  };
}

// Create a click event handler for deleting an item
function createDeleteItemHandler(item) {
  return function () {
    // Remove the item from the itemList
    var itemIndex = itemList.indexOf(item);
    if (itemIndex !== -1) {
      itemList.splice(itemIndex, 1);
    }

    // Save the updated itemList to local storage
    saveItemList();

    // Refresh the item list on the index.html page
    displayItemList();
  };
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

// Save the itemList array to local storage
function saveItemList() {
  localStorage.setItem('itemList', JSON.stringify(itemList));
}

// Retrieve the itemList array from local storage
function getItemListFromLocalStorage() {
  var itemListJSON = localStorage.getItem('itemList');
  return itemListJSON ? JSON.parse(itemListJSON) : null;
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();

// Check if the page is an item page and load the item content if necessary
if (window.location.pathname.includes('/thelist/item.html')) {
  loadItemContent();
}
