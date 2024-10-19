const fs = require('fs');
const fsPromises = fs.promises;
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');
const zlib = require('zlib');

const segmentsDir = path.join(__dirname, 'segments');
const extractedDir = path.join(__dirname, 'extracted');
let segmentURLs = [];


let datapoints = [];
let compiledData = {};
let idCount = 0;

//////////////////////////////////////////////////////////////////////////////////

const urlInput = 'https://samples.adsbexchange.com/readsb-hist/2024/10/01/';

const startHour = 23;

const dataFile = './data/' + startHour + '.json';
const takeFiles = 720; // 720 = 1 hours worth of 5-second segments


// 560 x 555 km geobox
const upperLeftLat = 53.0000;
const upperLeftLon = 5.0000;

const lowerRightLat = 48.0000;
const lowerRightLon = 13.0000;

//////////////////////////////////////////////////////////////////////////////////

(async () => {

  segmentURLs = await generateSegmentURLs();
  
  while(segmentURLs.length>0) {
  	let url = segmentURLs.shift();
  	
  	let fileName = await download(url);
  	let extractedFileName = fileName.replace('.gz', '');;
  	
  	await extractFile(fileName);
  	await processJsonFile(extractedFileName);
  	
  	console.log(fileName.replace('.json.gz', '') + '  ' + segmentURLs.length + ' files to go.');
  }
  
  // create data file
  await createDataFile();
  
  // write data to data.json
  await writeDataFile();

})();

function generateSegmentURLs(urlInput) {
    return new Promise((resolve, reject) => {
			
		let baseUrl = 'https://samples.adsbexchange.com/readsb-hist/2024/10/01/';
		let urlEnding = 'Z.json.gz';
		
		let hours = startHour;
		let minutes = 0;
		let seconds = 0;
				
		while (hours < 24 && segmentURLs.length < takeFiles) {

			const timeString = String(hours).padStart(2, '0') + String(minutes).padStart(2, '0') + String(seconds).padStart(2, '0');
							   
			segmentURLs.push(baseUrl + timeString + urlEnding);

			// Increment seconds by 5
			seconds += 5;

			// Handle overflow of seconds
			if (seconds >= 60) {
				seconds -= 60;
				minutes++;
			}

			// Handle overflow of minutes
			if (minutes >= 60) {
				minutes -= 60;
				hours++;
			}
		}
		resolve(segmentURLs);
	});
}

async function download(url) {
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
      resolve(fileName);
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
        resolve();
      })
      .on('error', (err) => {
        console.error(`Error decompressing ${inputFile}:`, err);
        reject(err);
      });
  });
};

const extractFile = async (file) => {
  try {

    const inputFile = path.join(segmentsDir, file);
    const outputFile = path.join(extractedDir, file.replace('.gz', ''));

    // Decompress each file and await the result
    await decompressFile(inputFile, outputFile);
	  
    // Delete the input file after extraction
    await fsPromises.unlink(inputFile);
    
  } catch (err) {
    console.error('Error processing files:', err);
  }
};

// Read .json files in the /extracted folder and process data
const processJsonFile = async (file) => {
  try {

      const inputFile = path.join(extractedDir, file);

      await compileFilteredContent(inputFile);
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
			const isNotOnGround = jsonData['aircraft'][i]['alt_baro'] != 'ground';
			
			if(isWithinLatLon && isNotOnGround) {
				jsonData['aircraft'][i]['now'] = Math.round(jsonData['now']); 
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

// Read .json files
const compileFilteredContent = (inputFile) => {
  return new Promise((resolve, reject) => {

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
		
		// Delete the json source
		fs.unlink(inputFile, ()=>{
			resolve();	
		});
		
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
				compiledData[hexValue] = {};
				compiledData[hexValue]['hex'] = datapoints[i]['hex'];
				compiledData[hexValue]['flight'] = datapoints[i]['flight'];
				compiledData[hexValue]['r'] = datapoints[i]['r'];
				compiledData[hexValue]['t'] = datapoints[i]['t'];
					
				compiledData[hexValue]['datapoints'] = [];
				idCount++;
			}
			
			let dataPoint = {};
			dataPoint['alt_baro'] = datapoints[i]['alt_baro'];
			dataPoint['gs'] = datapoints[i]['gs'];
			dataPoint['track'] = datapoints[i]['track'];
			dataPoint['squawk'] = datapoints[i]['squawk'];
			dataPoint['lat'] = datapoints[i]['lat'];
			dataPoint['lon'] = datapoints[i]['lon'];
			dataPoint['now'] = datapoints[i]['now'];

			compiledData[hexValue]['datapoints'].push(dataPoint);
		}

		fs.appendFile(dataFile, JSON.stringify(compiledData, null, 2), (err) => {
			if (err) {
				console.error(`Error writing to ${dataFile}:`, err);
				return reject(err);
			}
			console.log('Data file created. ' + idCount + ' IDs.');
			resolve();
		});
  });
};

