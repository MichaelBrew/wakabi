module.exports = {
    /*
     * The 'rideStages' var acts as an enum to represent where the current
     * rider is in the request process.
     * TODO: can we eliminate DRIVER here now there's a driveStages?
     *
     * NOTHING           : Before the request, all riders have sent nothing (default for riders)
     * AWAITING_LOCATION : The server has asked for their location, waiting for answer
     * AWAITING_TRAILER  : The server has asked if they need a trailer, waiting for answer
     * CONTACTING_DRIVER : The server has told them a driver will contact them
     * AWAITING_FEEDBACK : The server has asked how their ride was
     */
    rideStages: {
        NOTHING           : "nothing",
        AWAITING_LOCATION : "awaitingLocation",
        AWAITING_TRAILER  : "awaitingTrailer",
        CONTACTING_DRIVER : "contactingDriver",
        AWAITING_FEEDBACK : "AWAITING_FEEDBACK"
    },

    /*
     * The 'driveStages' var acts as an enum to represent where the current
     * driver is in the ride process.
     *
     * NOTHING                   : Driver has not yet started the ride process
     * AWAITING_START_LOCATION   : The server has asked the driver what location they are starting their shift in 
     * AWAITING_END_RIDE         : The driver has accepted a request and server is waiting for end ride text
     * AWAITING_UPDATED_LOCATION : The driver has ended ride and server is waiting for their new location
     */
    driveStages: {
        NOTHING                   : "nothing",
        AWAITING_START_LOCATION   : "awaitingStartLocation",
        AWAITING_END_RIDE         : "awaitingEndRide",
        AWAITING_UPDATED_LOCATION : "awaitingUpdatedLocation"
    }
};
