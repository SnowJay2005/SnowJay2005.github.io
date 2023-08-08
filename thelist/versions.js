// Firebase configuration
var firebaseConfig = {
    apiKey: "AIzaSyDPKjpimOZLKwNwfm_IQFm8X4Pv2ZgucIA",
    authDomain: "the-list-175d3.firebaseapp.com",
    databaseURL: "https://the-list-175d3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "the-list-175d3",
    storageBucket: "the-list-175d3.appspot.com",
    messagingSenderId: "133562798111",
    appId: "1:133562798111:web:34a18cd64c6202314cc52a"
    };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get a reference to the Firebase Realtime Database
var db = firebase.database();

// Function to display the versions
function displayVersions() {
  // Retrieve the item name from the URL hash
  var itemName = decodeURIComponent(location.hash.substr(1));

  // Set the item name in the header
  document.getElementById('item-name').textContent = itemName;

  // Get a reference to the versions of the item
  var versionsRef = db.ref('items/' + itemName);

  // Attach a listener to listen for changes in the versions
  versionsRef.on('value', function(snapshot) {
    var versionsListElement = document.getElementById('versions-list');
    versionsListElement.innerHTML = '';

    snapshot.forEach(function(childSnapshot) {
      var version = childSnapshot.key;
      var versionData = childSnapshot.val();

      var versionCard = document.createElement('div');
      versionCard.classList.add('item-card');

      var versionName = document.createElement('h2');
      versionName.textContent = version;

      var versionCount = document.createElement('p');
      versionCount.textContent = 'Count: ' + versionData.count;

      var versionImage = document.createElement('img');
      versionImage.src = versionData.image.replace('no', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/HD_transparent_picture.png/320px-HD_transparent_picture.png');
      versionImage.alt = version + ' Image';

      // Check if censorship is enabled in local storage
      var censorshipEnabled = localStorage.getItem('censorshipEnabled');
      if (censorshipEnabled === 'true') {
        versionImage.src = 'https://example.com/censor-image.png'; // Replace with the URL of your censor image
        versionImage.classList.add('censored-image'); // Add the 'censored-image' class
      } else {
        versionImage.src = versionData.image; // Show the original image
      }

      var versionDescription = document.createElement('p');
      versionDescription.innerHTML = versionData.description.replace(/\n/g, '<br>');

      versionCard.appendChild(versionName);
      versionCard.appendChild(versionCount);
      versionCard.appendChild(versionDescription);
      versionCard.appendChild(versionImage);
      versionsListElement.appendChild(versionCard);
    });
  });

  // Add an event listener to the button
  var toggleButton = document.getElementById('toggleCensorshipButton');
  toggleButton.addEventListener('click', function () {
    toggleImageCensorship();

  // Update the local storage value to match the current censorship status
  var censorshipEnabled = localStorage.getItem('censorshipEnabled');
  var newCensorshipStatus = (censorshipEnabled === 'true') ? 'false' : 'true';
  localStorage.setItem('censorshipEnabled', newCensorshipStatus);
  });
}

// Function to toggle image censorship
function toggleImageCensorship() {
  var images = document.querySelectorAll('img');

  if (images.length > 0) {
    for (var i = 0; i < images.length; i++) {
      var image = images[i];
      var censorImageURL = 'https://media.discordapp.net/attachments/784434827163598898/1138379532198486077/censored_images.png?width=1440&height=288'; // Replace with the URL of your censor image

      if (image.classList.contains('censored-image')) {
        // If the image is currently censored, show the original image
        image.src = image.dataset.originalSrc; // Use the original image URL stored in 'data-original-src'
      } else {
        // If the image is currently not censored, censor it by showing the censor image
        image.dataset.originalSrc = image.src; // Store the original image URL in 'data-original-src'
        image.src = censorImageURL; // Replace the 'src' attribute with the censor image URL
      }

      // Toggle the 'censored-image' class
      image.classList.toggle('censored-image');
    }

    // Store the user's preference in local storage
    var censorshipEnabled = images[0].classList.contains('censored-image');
    localStorage.setItem('censorshipEnabled', censorshipEnabled);
  }
}

// Call the displayVersions function when the page loads
window.onload = displayVersions;