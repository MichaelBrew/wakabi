rq = require("request-promise")

var removeDriverNum = ""

function removeDriverClicked(driverNum) {
  console.log("removeDriverClicked: driverNum = " + driverNum)

  removeDriverNum = driverNum
  $(".modal-text").text("Are you sure you want to remove driver +" + removeDriverNum + "?")
}

function removeDriver() {
  $(".modal-body").html("<div class='spinner-loader'>Loading…</div>")

  var url = 'http://wakabi.herokuapp.com/drivercenter/remove?driver+' +removeDriverNum

  rq(url).then(
    console.log("driver removed!!")
    $(".modal-body").html("<p>Driver successfully removed!</p>")
  ).catch(
    console.log("driver not removed!!")
    $(".modal-body").html("<p>Error</p>")
  )
}
