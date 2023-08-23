import Design from "./Design";
import WebDev from "./WebDev";
import Skills from "./Skills";
import MobileDev from "./MobileDev";


function ActiveComponent({ activeLink }:any) {
    if (activeLink === 'skills') {
      return <Skills/>;
    } else if (activeLink === 'design') {
      return <Design/>;
    } else if (activeLink === 'web-development') {
      return <WebDev/>;
    } else if (activeLink === 'mobile-development') {
      return <MobileDev/>;
    }
    return null;
  }

  export default ActiveComponent;