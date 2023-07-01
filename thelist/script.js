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
      updateItemPage(item);
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
  itemImageElement.src = item.image; // Replace with the actual property name for the image URL
  itemDescriptionElement.textContent = item.description; // Replace with the actual property name for the description
}