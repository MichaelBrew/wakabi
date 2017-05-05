module.exports = {
  /*
   * The 'rideStages' var acts as an enum to represent where the current
   * rider is in the request process.
   *
   * TODO: can we eliminate DRIVER here now there's a driveStages?
   */
  rideStages: {
    // Before the request, all riders have sent nothing (default for riders)
    NOTHING: 'nothing',

    // The server has asked for their location, waiting for answer
    AWAITING_LOCATION: 'awaitingLocation',

    // The server has asked if they need a trailer, waiting for answer
    AWAITING_TRAILER: 'awaitingTrailer',

    // The server has told them a driver will contact them
    CONTACTING_DRIVER: 'contactingDriver',

    // The server has asked how their ride was
    AWAITING_FEEDBACK: 'AWAITING_FEEDBACK'
  },

  /*
   * The 'driveStages' var acts as an enum to represent where the current
   * driver is in the ride process.
   */
  driveStages: {
    // Driver has not yet started the ride process
    NOTHING: 'nothing',

    // The server has asked the driver what location they are starting their shift in
    AWAITING_START_LOCATION: 'awaitingStartLocation',

    // The driver has accepted a request and server is waiting for end ride text
    AWAITING_END_RIDE: 'awaitingEndRide',

    // The driver has ended ride and server is waiting for their new location
    AWAITING_UPDATED_LOCATION: 'awaitingUpdatedLocation'
  }
}
