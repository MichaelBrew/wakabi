var removeDriverNum = ""

function removeDriverClicked(driverNum) {
  console.log("removeDriverClicked: driverNum = " + driverNum)

  removeDriverNum = driverNum
  $(".modal-text").text("Are you sure you want to remove driver +" + removeDriverNum + "?")
}

function removeDriver() {
  console.log("Attempting to remove driver " + removeDriverNum)
  $(".modal-body").html("<div class='spinner-loader'>Loading…</div>")

  //onClick="removeDriver('#{driver.num}')
}