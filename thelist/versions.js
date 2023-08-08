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

      var versionDescription = document.createElement('p');
      versionDescription.innerHTML = versionData.description.replace(/\n/g, '<br>');

      versionCard.appendChild(versionName);
      versionCard.appendChild(versionCount);
      versionCard.appendChild(versionDescription);
      versionCard.appendChild(versionImage);
      versionsListElement.appendChild(versionCard);
    });
  });
}

// Function to toggle image censorship
function toggleImageCensorship() {
  var images = document.querySelectorAll('img');

  if (images.length > 0) {
    for (var i = 0; i < images.length; i++) {
      var image = images[i];
      image.classList.toggle('censored-image');
    }

    // Store the user's preference in local storage
    var censorshipEnabled = images[0].classList.contains('censored-image');
    localStorage.setItem('censorshipEnabled', censorshipEnabled);
  }
}

// Check if the user's preference is stored in local storage and apply it
var censorshipEnabled = localStorage.getItem('censorshipEnabled');
if (censorshipEnabled === 'true') {
  toggleImageCensorship();
}

// Add an event listener to the button
var toggleButton = document.getElementById('toggleCensorshipButton');
toggleButton.addEventListener('click', toggleImageCensorship);

// Call the displayVersions function when the page loads
window.onload = displayVersions;