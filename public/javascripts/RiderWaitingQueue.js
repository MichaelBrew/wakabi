// This way of exporting/mimicking a static variable is not working
// For now, just using global.riderWaitingQueue and modfiying it in RiderMessenger.js

module.exports = {
  isRiderWaiting: function(number) {
    queue = global.riderWaitingQueue;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].number == number) {
        return true;
      }
    }
    return false;
  },
  addRiderWithZoneToQueue: function(riderNum, zone) {
    rider = {
      number: riderNum,
      location: zone
    }
    global.riderWaitingQueue.push(rider);
  },
  removeRiderFromQueue: function(riderNum) {
    queue = global.riderWaitingQueue;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].number == riderNum) {
        queue.splice(i, 1);
      }
    }
  },
  getRidersWaitingInZone: function(zone) {
    queue = global.riderWaitingQueue;
    riders = [];
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].location == zone) {
        riders.push(queue[i].number);
      }
    }

    return riders;
  }
};
