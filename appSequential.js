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
let idCount = 0;

const CONCURRENCY_LIMIT = 8;
const urlInput = 'https://samples.adsbexchange.com/readsb-hist/2024/10/01/';

const startAtFile = '120000Z.json.gz'; // 000000Z.json.gz to 235955Z.json.gz
const takeFiles = 720; // 720 = 1 hours worth of 5-second segments

const upperLeftLat = 52.0000;
const upperLeftLon = 5.0000;

const lowerRightLat = 49.0000;
const lowerRightLon = 8.0000;

// state variables
let segmentURLs;

(async () => {

  // load URLs from webpage
  segmentURLs = await getSegmentURLs(urlInput);

  
  while(segmentURLs.length>0) {
  	let url = segmentURLs.shift();
  	
  	let fileName = await download(url);
  	let extractedFileName = fileName.replace('.gz', '');;
  	
  	await extractFile(fileName);
  	await processJsonFile(extractedFileName);
  }
  
  // create data file
  await createDataFile();
  
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
      console.log(url);
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
        //console.log(`Decompressed ${inputFile}`);
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
				
				if(isWithinLatLon) {
					//console.log(jsonData['aircraft'][i]);
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
		
		console.log('Delete ' + inputFile);
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
				compiledData[hexValue] = JSON.parse(JSON.stringify(datapoints[i]));
				delete compiledData[hexValue]['now'];
				delete compiledData[hexValue]['nic'];
				delete compiledData[hexValue]['rc'];
				delete compiledData[hexValue]['alt_baro'];
				delete compiledData[hexValue]['gs'];
				delete compiledData[hexValue]['true_heading'];
				delete compiledData[hexValue]['squawk'];
				delete compiledData[hexValue]['emergency'];
				delete compiledData[hexValue]['alt_geom'];
				delete compiledData[hexValue]['track'];
				delete compiledData[hexValue]['baro_rate'];
				delete compiledData[hexValue]['nav_qnh'];
				delete compiledData[hexValue]['nav_altitude_mcp'];
				delete compiledData[hexValue]['nav_altitude_fms'];
				delete compiledData[hexValue]['nav_modes'];
				delete compiledData[hexValue]['lat'];
				delete compiledData[hexValue]['lon'];
				delete compiledData[hexValue]['seen_pos'];
				delete compiledData[hexValue]['version'];
				delete compiledData[hexValue]['nic_baro'];
				delete compiledData[hexValue]['nac_p'];
				delete compiledData[hexValue]['nac_v'];
				delete compiledData[hexValue]['sil'];
				delete compiledData[hexValue]['sil_type'];
				delete compiledData[hexValue]['gva'];
				delete compiledData[hexValue]['sda'];
				delete compiledData[hexValue]['alert'];
				delete compiledData[hexValue]['spi'];
				delete compiledData[hexValue]['mlat'];
				delete compiledData[hexValue]['tisb'];
				delete compiledData[hexValue]['messages'];
				delete compiledData[hexValue]['seen'];
				delete compiledData[hexValue]['rssi'];
				
				delete compiledData[hexValue]['ias'];
				delete compiledData[hexValue]['tas'];
				delete compiledData[hexValue]['mach'];
				delete compiledData[hexValue]['wd'];
				delete compiledData[hexValue]['ws'];
				delete compiledData[hexValue]['oat'];
				delete compiledData[hexValue]['tat'];
				delete compiledData[hexValue]['track_rate'];
				delete compiledData[hexValue]['roll'];
				delete compiledData[hexValue]['mag_heading'];
				delete compiledData[hexValue]['geom_rate'];
					
				compiledData[hexValue]['datapoints'] = [];
				idCount++;
			}
			
			let dataPoint = JSON.parse(JSON.stringify(datapoints[i]));

			delete dataPoint['hex'];
			delete dataPoint['type'];
			delete dataPoint['flight'];
			delete dataPoint['r'];
			delete dataPoint['t'];
			delete dataPoint['category'];
			delete dataPoint['nic'];
			delete dataPoint['rc'];
			delete dataPoint['nav_qnh'];
			delete dataPoint['nav_altitude_mcp'];
			delete dataPoint['nav_altitude_fms'];
			delete dataPoint['nav_modes'];
			delete dataPoint['seen_pos'];
			delete dataPoint['version'];
			delete dataPoint['nic_baro'];
			delete dataPoint['nac_p'];
			delete dataPoint['nac_v'];
			delete dataPoint['sil'];
			delete dataPoint['sil_type'];
			delete dataPoint['gva'];
			delete dataPoint['sda'];
			delete dataPoint['alert'];
			delete dataPoint['spi'];
			delete dataPoint['mlat'];
			delete dataPoint['tisb'];
			delete dataPoint['messages'];
			delete dataPoint['seen'];
			delete dataPoint['rssi'];

			compiledData[hexValue]['datapoints'].push(dataPoint);
		}

		fs.appendFile(dataFile, JSON.stringify(compiledData, null, 2), (err) => {
			if (err) {
				console.error(`Error writing to ${dataFile}:`, err);
				return reject(err);
			}
			console.log('Filtered data written. ' + idCount + ' IDs.');
			resolve();
		});
  });
};

