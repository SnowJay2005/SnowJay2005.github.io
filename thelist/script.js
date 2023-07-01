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
      var itemPageURL = 'item.html#' + encodeURIComponent(item.name);
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

    var itemCount = document.createElement('p');
    itemCount.textContent = 'Count: ' + item.count;

    itemCard.appendChild(itemName);
    itemCard.appendChild(itemCount);
    itemListElement.appendChild(itemCard);
  }
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();