# ADSB-downloader

## Data source

Data is downloaded from https://samples.adsbexchange.com/readsb-hist/

Data files are split into 5 second segments thus 24 hours = 17280 individual files.

If each file is 600 kB on average, then a full 24 hour history is approximately 10GB.

## ADS-B fields

- **hex**: The ICAO 24-bit transponder code, a unique identifier assigned to each aircraft.
- **type**: The type of ADS-B message being sent (e.g., `adsc`, `adsb_icao`). 
- **flight**: The aircraft’s flight number, which is the identifier used by airlines (e.g., "ASA184").
- **r**: Aircraft registration, the tail number of the aircraft (e.g., "N566AS").
- **t**: Aircraft type or model, such as B738 (Boeing 737-800) or B789 (Boeing 787-9).
- **alt_baro**: Altitude of the aircraft in feet, based on barometric pressure readings.
- **alt_geom**: Geometric (GPS-derived) altitude in feet, where available.
- **gs**: Ground speed of the aircraft in knots.
- **track**: Aircraft’s track or heading over the ground, in degrees (e.g., 260.65°).
- **baro_rate**: The rate of climb or descent, in feet per minute, based on barometric altitude.
- **geom_rate**: The rate of climb or descent, in feet per minute, based on geometric altitude.
- **squawk**: The squawk code assigned by air traffic control for identification.
- **emergency**: Emergency status, indicating if the aircraft has declared an emergency (e.g., "none").
- **category**: A code indicating the size and type of the aircraft (e.g., A3, A5, A1).
- **lat**: Latitude of the aircraft's current position.
- **lon**: Longitude of the aircraft's current position.
- **nic**: Navigation Integrity Category, indicating the precision of the aircraft's position (higher is better).
- **rc**: Radius of Containment, the horizontal integrity requirement in meters.
- **seen_pos**: Time in seconds since the last valid position was received.
- **version**: The ADS-B message version number being used by the aircraft.
- **nic_baro**: Integrity of the barometric altitude data.
- **nac_p**: Navigation Accuracy Category for Position, indicates position accuracy.
- **nac_v**: Navigation Accuracy Category for Velocity, indicates velocity accuracy.
- **sil**: Source Integrity Level, indicating the integrity of the data (higher numbers indicate higher integrity).
- **sil_type**: Defines the interval for SIL values (e.g., "perhour").
- **gva**: Geometric Vertical Accuracy, indicating vertical positioning accuracy.
- **sda**: System Design Assurance, representing the reliability of the system.
- **alert**: Whether the aircraft has triggered an altitude alert.
- **spi**: Special Position Identification, indicating the squawk SPI flag (on or off).
- **nav_qnh**: The QNH altimeter setting in hPa, used by the aircraft’s navigation system.
- **nav_altitude_mcp**: The altitude set in the aircraft's Mode Control Panel (MCP) in feet.
- **nav_heading**: The heading set in the aircraft’s autopilot or navigation system.
- **nav_modes**: List of navigation modes the aircraft is using (e.g., autopilot, vnav, lnav, tcas).
- **mlat**: Multi-lateration data, if available, a system to triangulate aircraft position.
- **tisb**: Traffic Information Service - Broadcast, data from ground stations to aircraft.
- **messages**: The number of ADS-B messages received from the aircraft.
- **seen**: Time in seconds since the last message was received.
- **rssi**: Received Signal Strength Indicator, showing the strength of the ADS-B signal in dB.
