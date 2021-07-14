

var UserInterface = function(domElement) {
    var self = this;
    self.domElement = domElement;
    self.domTabs = self.domElement.getElementsByClassName("settings-tab");

    self.init = function() {
        for(var tab = 0; tab < self.domTabs.length; tab++) {
            self.domTabs[tab].children[1].style.display = "none";
            self.domTabs[tab].children[0].addEventListener("click", function(event) {
                if (this.parentNode.children[1].style.display == "none") this.parentNode.children[1].style.display = "block";
                else this.parentNode.children[1].style.display = "none";
            });
        }
    }

}
export{ UserInterface };