// Retrieve the item name from the URL
var itemName = decodeURIComponent(window.location.hash.substr(1));

// Get a reference to the versions of the selected item
var versionsRef = db.ref('items/' + itemName);

// Function to display the versions of the selected item
function displayVersions() {
  versionsRef.on('value', function (snapshot) {
    versionsListElement.innerHTML = '';

    try {
      snapshot.forEach(function (childSnapshot) {
        var version = childSnapshot.key; // Get the version key
        var versionData = childSnapshot.val(); // Get the version data

        var versionCard = document.createElement('div');
        versionCard.classList.add('version-card');

        var versionName = document.createElement('h2');
        versionName.textContent = version;

        var versionCount = document.createElement('p');
        versionCount.textContent = 'Count: ' + versionData.count;

        var versionDescription = document.createElement('p');
        versionDescription.textContent = 'Description: ' + versionData.description;

        var versionImage = document.createElement('img');
        versionImage.src = versionData.image;
        versionImage.alt = version;

        versionCard.appendChild(versionName);
        versionCard.appendChild(versionCount);
        versionCard.appendChild(versionDescription);
        versionCard.appendChild(versionImage);
        versionsListElement.appendChild(versionCard);
      });
    } catch (e) {
      console.error(e);
    }
  });
}

// Call the function to display the versions
displayVersions();