const fs = require('fs');
const fsPromises = fs.promises;
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');
const zlib = require('zlib');

const segmentsDir = path.join(__dirname, 'segments');
const extractedDir = path.join(__dirname, 'extracted');
const dataFile = './data.json';

let datapoints = [];
let compiledData = {};

const CONCURRENCY_LIMIT = 8;
const urlInput = 'https://samples.adsbexchange.com/readsb-hist/2023/01/01/';

const startAtFile = '000000Z.json.gz'; // 000000Z.json.gz to 235955Z.json.gz
const takeFiles = 8000; // 720 = 1 hours worth of 5-second segments

const upperLeftLat = 52.0000;
const upperLeftLon = 5.0000;
const lowerRightLat = 49.0000;
const lowerRightLon = 12.0000;

// state variables
let segmentURLs;

(async () => {

  // load URLs from webpage
  segmentURLs = await getSegmentURLs(urlInput);

  // download individual .json.gz files
  await downloadSegmentsConcurrently(segmentURLs, CONCURRENCY_LIMIT);
  
  // extract to extracted folder
  await extractFiles();
  
  // create data file
  await createDataFile();
  
  // filter json data
  await processJsonFiles();
  
  // write data to data.json
  await writeDataFile();

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
						if(lineString == startAtFile) {
							segmentURLs.push(urlInput + lineString);
						} else if(segmentURLs.length > 0 && segmentURLs.length < takeFiles) {
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

// Function to decompress a .json.gz file and save as .json
const decompressFile = (inputFile, outputFile) => {
  return new Promise((resolve, reject) => {
    const fileContents = fs.createReadStream(inputFile);
    const writeStream = fs.createWriteStream(outputFile);
    const unzip = zlib.createGunzip();

    fileContents
      .pipe(unzip)  // Decompress
      .pipe(writeStream)  // Write to output
      .on('finish', () => {
        //console.log(`Decompressed ${inputFile}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`Error decompressing ${inputFile}:`, err);
        reject(err);
      });
  });
};

// Read .json.gz files in the /segments folder and extract to /extracted
const extractFiles = async () => {
  try {

    // Read the directory and get the list of files
    const files = await fsPromises.readdir(segmentsDir);

    // Filter out non-.json.gz files
    const jsonGzFiles = files.filter(file => file.endsWith('.json.gz'));

    // Process each file asynchronously
    for (const file of jsonGzFiles) {
      const inputFile = path.join(segmentsDir, file);
      const outputFile = path.join(extractedDir, file.replace('.gz', ''));  // Remove .gz suffix for output

      // Decompress each file and await the result
      await decompressFile(inputFile, outputFile);
    }

    console.log('All files have been extracted.');
  } catch (err) {
    console.error('Error processing files:', err);
  }
};

// Read .json files in the /extracted folder and process data
const processJsonFiles = async () => {
  try {

    // Read the directory and get the list of files
    const files = await fsPromises.readdir(extractedDir);

    // Filter out non-.json.gz files
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Process each file asynchronously
    for (const file of jsonFiles) {
      const inputFile = path.join(extractedDir, file);

      // filter each files content and await the result
      await writeFilteredContent(inputFile);
    }

    console.log('All files have been processed.');
  } catch (err) {
    console.error('Error processing files:', err);
  }
};

function parseJsonAndFilter(jsonString) {
    try {
        const jsonData = JSON.parse(jsonString);
		const returnData = [];
		
        // Check if the 'aircraft' key exists and return it
        if (jsonData.hasOwnProperty('aircraft')) {
			for(let i=0; i<jsonData['aircraft'].length; i++) {
				
				const isWithinLat1 = jsonData['aircraft'][i]['lat'] <= upperLeftLat;
				const isWithinLon1 = jsonData['aircraft'][i]['lon'] >= upperLeftLon;
				const isWithinLat2 = jsonData['aircraft'][i]['lat'] >= lowerRightLat;
				const isWithinLon2 = jsonData['aircraft'][i]['lon'] <= lowerRightLon;
				
				const isWithinLatLon = isWithinLat1 && isWithinLon1 && isWithinLat2 && isWithinLon2;
				
				if(isWithinLatLon) {
					//console.log(jsonData['aircraft'][i]);
					returnData.push(jsonData['aircraft'][i]);
				}
			}
            return returnData;
        } else {
            throw new Error("Key 'aircraft' not found in JSON data.");
        }
    } catch (error) {
        console.error("Error parsing JSON data: ", error);
        return null;
    }
}

// Function to decompress a .json.gz file and save as .json
const writeFilteredContent = (inputFile) => {
  return new Promise((resolve, reject) => {
    console.log('Processing file: ' + inputFile);

    // Read the entire file content as a string
    fs.readFile(inputFile, 'utf8', (err, data) => {
      if (err) {
        console.error(`Error reading file ${inputFile}:`, err);
        return reject(err);
      }

      try {
        // Parse the file content as JSON
        const filteredData = parseJsonAndFilter(data);

		// Append the filtered data to the datapoints
		datapoints = datapoints.concat(filteredData);
        resolve();

      } catch (error) {
        console.error(`Error processing JSON in file ${inputFile}:`, error);
        reject(error);
      }
    });
  });
};

const createDataFile = () => {
  return new Promise((resolve, reject) => {
		fs.closeSync(fs.openSync(dataFile, 'w'));
		resolve();
  });
};

const writeDataFile = () => {
  return new Promise((resolve, reject) => {
	  
		for(let i=0; i<datapoints.length; i++) {
			
			let hexValue = datapoints[i]['hex'];
			
			if(!compiledData.hasOwnProperty(hexValue)) {
				compiledData[hexValue] = [];
			}
			
			compiledData[hexValue].push(datapoints[i]);
		}

		fs.appendFile(dataFile, JSON.stringify(compiledData, null, 2), (err) => {
			if (err) {
				console.error(`Error writing to ${dataFile}:`, err);
				return reject(err);
			}
			console.log('Filtered data written');
			resolve();
		});
  });
};


