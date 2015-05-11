module.exports = {
    /*
     * The 'rideStages' var acts as an enum to represent where the current
     * rider is in the request process.
     * TODO: can we eliminate DRIVER here now there's a driveStages?
     *
     * DRIVER            : All drivers' rideStage is marked DRIVER (default for drivers)
     * NOTHING           : Before the request, all riders have sent nothing (default for riders)
     * AWAITING_LOCATION : The server has asked for their location, waiting for answer
     * AWAITING_TRAILER  : The server has asked if they need a trailer, waiting for answer
     * CONTACTING_DRIVER : The server has told them a driver will contact them
     */
    rideStages: {
        DRIVER             : "driver",
        NOTHING            : "nothing",
        AWAITING_LOCATION  : "awaitingLocation",
        AWAITING_TRAILER   : "awaitingTrailer",
        CONTACTING_DRIVER  : "contactingDriver",
        AWAITING_DRIVER    : "awaitingDrivier"
    },

    /*
     * The 'driveStages' var acts as an enum to represent where the current
     * driver is in the ride process.
     *
     * NOTHING           : Driver has not yet started the ride process
     * SENT_RIDER_NUMBER : If the ride request is accepted, the rider's number has been sent
     * RIDE_STARTED      : The driver has indicated the start of the ride
     * RIDE_ENDED        : The driver has indicated the end of the ride
     */
    driveStages: {
        NOTHING                   : "nothing",
        AWAITING_START_LOCATION   : "awaitingStartLocation",
        AWAITING_END_RIDE         : "awaitingEndRide",
        AWAITING_UPDATED_LOCATION : "awaitingUpdatedLocation"
    }
};
