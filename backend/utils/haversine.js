/**
 * Haversine formula — calculates great-circle distance between two
 * geographic coordinates. Used for office geofence validation.
 */

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

const isWithinGeofence = (userLat, userLon, officeLat, officeLon, radiusMeters) => {
  const distance = haversineDistance(userLat, userLon, officeLat, officeLon);
  return distance <= radiusMeters;
};

// Named alias required by the attendance controller spec
const calculateHaversineDistance = haversineDistance;

module.exports = { haversineDistance, calculateHaversineDistance, isWithinGeofence };
