// Function to check if API key is present in local storage (returns a promise)
function checkApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiKey'], function(result) {
      if (!result.apiKey) {
        // If API key is not present, prompt the user to enter it
        const apiKey = prompt("Please enter your API key:");
        if (apiKey) {
          // Store the API key in local storage
          chrome.storage.local.set({ apiKey: apiKey }, function() {
            console.log('API key stored successfully.');
            resolve(apiKey); // Resolve with the newly stored API key
          });
        } else {
          reject('No API key provided.');
        }
      } else {
        console.log('API key retrieved:', result.apiKey);
        resolve(result.apiKey); // Resolve with the stored API key
      }
    });
  });
}

// Function to get the current tab's URL
const getLength = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        resolve(tabs[0].url);  // Resolve with the current tab's URL
      } else {
        reject('No active tab found');
      }
    });
  });
};

// Function to show the loading message
const showLoadingMessage = () => {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('length').textContent = ''; // Clear previous content
  document.getElementById('speeds').innerHTML = ''; // Clear previous speed data
};

// Function to hide the loading message
const hideLoadingMessage = () => {
  document.getElementById('loading').style.display = 'none';
};

// Function to get playlist duration, modified to accept the API key
const getPlaylistDuration = async (apiKey) => {
  try {
    showLoadingMessage();
    const playlistUrl = await getLength();
    const playlistId = extractPlaylistId(playlistUrl);
    if (playlistId) {
      await getPlaylistTotalDuration(playlistId, apiKey);  // Pass API key to function
    } else {
      document.getElementById('length').textContent = 'Invalid playlist URL';
    }
  } catch (error) {
    document.getElementById('length').textContent = 'Error fetching playlist URL';
    console.error(error);
  } finally {
    hideLoadingMessage();
  }
};

// Function to extract the playlist ID from the URL
function extractPlaylistId(url) {
  const urlParams = new URLSearchParams(new URL(url).search);
  return urlParams.get('list');
}

// Function to get total playlist duration, modified to accept the API key
async function getPlaylistTotalDuration(playlistId, apiKey) {
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
  let totalDurationSeconds = 0;
  let nextPageToken = '';
  let isLastPage = false;

  try {
    do {
      const response = await fetch(`${playlistUrl}&pageToken=${nextPageToken}`);
      const data = await response.json();
      const videoIds = data.items.map(item => item.contentDetails.videoId).join(',');

      if (videoIds) {
        const videoData = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`);
        const videoDetails = await videoData.json();

        videoDetails.items.forEach(video => {
          const duration = video.contentDetails.duration;
          totalDurationSeconds += parseDurationToSeconds(duration);
        });
      }

      nextPageToken = data.nextPageToken || null;
      isLastPage = !nextPageToken;
    } while (!isLastPage);

    // Display the total duration at normal speed
    document.getElementById('length').textContent = `Total playlist duration: ${formatDuration(totalDurationSeconds)}`;

    // Display the total duration for each speed
    displaySpeeds(totalDurationSeconds);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    document.getElementById('length').textContent = 'Error fetching playlist data';
  }
}

// Function to convert YouTube's ISO 8601 duration format to seconds
function parseDurationToSeconds(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = (parseInt(match[1], 10) || 0);
  const minutes = (parseInt(match[2], 10) || 0);
  const seconds = (parseInt(match[3], 10) || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

// Function to format seconds into a readable time format <hours> hours <minutes> minutes <seconds> seconds
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60); // Floor seconds

  const hoursText = hours > 0 ? `${hours} hours` : '';
  const minutesText = minutes > 0 ? `${minutes} minutes` : '';
  const secondsText = secs > 0 ? `${secs} seconds` : '';

  return [hoursText, minutesText, secondsText].filter(Boolean).join(' ').trim();
}

// Function to display the total duration for different playback speeds
function displaySpeeds(totalSeconds) {
  const speeds = [1.25, 1.5, 1.75, 2];
  const speedsContainer = document.getElementById('speeds');

  speeds.forEach(speed => {
    const speedDuration = totalSeconds / speed;
    const formattedDuration = formatDuration(speedDuration);
    const speedElement = document.createElement('div');
    speedElement.className = 'speed-duration';
    speedElement.textContent = `At ${speed}x speed: ${formattedDuration}`;
    speedsContainer.appendChild(speedElement);
  });
}

// Start the process (main function)
(async function() {
  try {
    const apiKey = await checkApiKey();  // Await the API key retrieval
    await getPlaylistDuration(apiKey);   // Pass the API key to the main function
  } catch (error) {
    console.error('Error retrieving API key:', error);
  }
})();
