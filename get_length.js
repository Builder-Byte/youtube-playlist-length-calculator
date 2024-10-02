// Function to retrieve or prompt for an API key from local storage
function getOrPromptForApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiKey'], function (result) {
      if (!result.apiKey) {
        const apiKey = prompt("Please enter your API key:");
        if (apiKey) {
          chrome.storage.local.set({ apiKey: apiKey }, function () {
            console.log('API key stored successfully.');
            resolve(apiKey);
          });
        } else {
          reject('No API key provided.');
        }
      } else {
        console.log('API key retrieved:', result.apiKey);
        resolve(result.apiKey);
      }
    });
  });
}

// Function to get the URL of the current active tab
const getCurrentTabUrl = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        resolve(tabs[0].url);
      } else {
        reject('No active tab found');
      }
    });
  });
};

// Function to display the loading message
const showLoadingIndicator = () => {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('length').textContent = '';
  document.getElementById('speeds').innerHTML = '';
};

// Function to hide the loading message
const hideLoadingIndicator = () => {
  document.getElementById('loading').style.display = 'none';
};

// Function to fetch and display the total duration of a YouTube playlist
const fetchAndDisplayPlaylistDuration = async (apiKey) => {
  try {
    showLoadingIndicator();
    const playlistUrl = await getCurrentTabUrl();
    const playlistId = extractPlaylistIdFromUrl(playlistUrl);
    if (playlistId) {
      await calculateAndDisplayTotalDuration(playlistId, apiKey);
    } else {
      document.getElementById('length').textContent = 'Invalid playlist URL';
    }
  } catch (error) {
    document.getElementById('length').textContent = 'Error fetching playlist URL';
    console.error(error);
  } finally {
    hideLoadingIndicator();
  }
};

// Function to extract the playlist ID from a URL
function extractPlaylistIdFromUrl(url) {
  const urlParams = new URLSearchParams(new URL(url).search);
  return urlParams.get('list');
}

// Function to calculate and display the total duration of a YouTube playlist
async function calculateAndDisplayTotalDuration(playlistId, apiKey) {
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
          totalDurationSeconds += convertIso8601DurationToSeconds(duration);
        });
      }

      nextPageToken = data.nextPageToken || null;
      isLastPage = !nextPageToken;
    } while (!isLastPage);

    document.getElementById('length').textContent = `Total playlist duration: ${formatDuration(totalDurationSeconds)}`;
    displayDurationAtDifferentSpeeds(totalDurationSeconds);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    document.getElementById('length').textContent = 'Error fetching playlist data';
  }
}

// Function to convert ISO 8601 duration format to seconds
function convertIso8601DurationToSeconds(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = (parseInt(match[1], 10) || 0);
  const minutes = (parseInt(match[2], 10) || 0);
  const seconds = (parseInt(match[3], 10) || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

// Function to format seconds into a readable time format
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const hoursText = hours > 0 ? `${hours} hours` : '';
  const minutesText = minutes > 0 ? `${minutes} minutes` : '';
  const secondsText = secs > 0 ? `${secs} seconds` : '';

  return [hoursText, minutesText, secondsText].filter(Boolean).join(' ').trim();
}

// Function to display the total duration for different playback speeds
function displayDurationAtDifferentSpeeds(totalSeconds) {
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
(async function () {
  try {
    const apiKey = await getOrPromptForApiKey();
    await fetchAndDisplayPlaylistDuration(apiKey);
  } catch (error) {
    console.error('Error retrieving API key:', error);
  }
})();
