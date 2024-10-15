const fs = require('fs');
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');
const util = require('util');

const CONCURRENCY_LIMIT = 8;
const urlInput = 'https://samples.adsbexchange.com/readsb-hist/2023/01/01/';

const startAtFile = '115655Z.json.gz';
const takeFiles = 720;

// state variables
let segmentURLs;

(async () => {

  // load URLs from url address like: 
  segmentURLs = await getSegmentURLs(urlInput);

  // download
  await downloadSegmentsConcurrently(segmentURLs, CONCURRENCY_LIMIT);

})();



function getSegmentURLs(urlInput) {
  
    return new Promise((resolve, reject) => {
		
        https.get(urlInput, (res) => {
            let data = '';

            // Collect the data chunks
            res.on('data', (chunk) => {
                data += chunk;
            });

            // Once all data is received, resolve the promise with the HTML content
            res.on('end', () => {
				
				let segmentURLs = [];
				let linesArray = data.split(/\r?\n/);
				
				for (let i = 0; i < linesArray.length; i++) {

					if (linesArray[i].indexOf('.json.gz') > 0) {
						let lineString = linesArray[i];
						lineString = lineString.replace('<span class="name"><a href="', '');
						lineString = lineString.split('">')[0];

						let url = lineString;
						if(lineString == startAtFile) (
							segmentURLs.push(urlInput + lineString);
						) else if(segmentURLs.length > 0 && segmentURLs.length < takeFiles) {
							segmentURLs.push(urlInput + lineString);
						}

					}
				}
                resolve(segmentURLs);
            });

        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function download(url, percent) {
  const proto = !url.charAt(4).localeCompare('s') ? https : http;

  let fileName = url.split('/')[(url.split('/').length - 1)];
  let filePath = './segments/' + fileName;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let fileInfo = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        fs.unlink(filePath, () => {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        });
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'], 10),
      };

      response.pipe(file);
    });

    // The destination stream is ended by the time it's called
    file.on('finish', () => {
      console.log(url + ' ' + percent);
      resolve(fileInfo);
    });

    request.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    file.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    request.end();
  });
}

async function downloadSegmentsConcurrently(urls, limit) {
  const downloadPromises = [];
  for (let i = 0; i < urls.length; i++) {
    let progress = Math.floor((i / urls.length) * 100) + '%';
    downloadPromises.push(download(urls[i], progress));

    if (downloadPromises.length >= limit) {
      await Promise.all(downloadPromises);
      downloadPromises.length = 0; // Clear the array to allow new concurrent downloads
    }
  }

  // Wait for any remaining downloads to finish
  if (downloadPromises.length > 0) {
    await Promise.all(downloadPromises);
  }
}

