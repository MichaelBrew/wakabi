var removeDriverNum = ""

function removeDriverClicked(driverNum) {
  console.log("removeDriverClicked: driverNum = " + driverNum)

  removeDriverNum = driverNum
  $(".modal-body").val("Are you sure you want to remove driver " + removeDriverNum + "?")
}

function removeDriver() {
  console.log("Attempting to remove driver " + removeDriverNum)

  //onClick="removeDriver('#{driver.num}')
}