/**
 * All Mangas Reader V2
 * Content script included in every website matching a manga site
 */

import Vue from "vue"
import 'vuetify/dist/vuetify.min.css';
import Vuetify from 'vuetify';
import theme from '../pages/theme';

import AmrReader from './AmrReader.vue';

import browser from "webextension-polyfill";
import mirrorImpl from '../content/mirrorimpl';
import pageData from '../content/pagedata';
import options from '../content/options';

import mirrorHelper from '../amr/mirrors-helper';

if (window["__armreader__"] === undefined) { // avoid loading script twice
    window["__armreader__"] = {}

    /**
     * Every mirror implementation ends by a call to registerMangaObject
     * This function is defined here.
     * This script is injected by background script if the page could be a manga page. 
     * Once loaded, the mirror implementation is called and results in this function call
     */
    window["registerMangaObject"] = async function (object) {
        // initialize options
        options.load(await browser.runtime.sendMessage({action: "getoptions"}));
        
        console.log("Mirror implementation " + object.mirrorName + " loaded in page.");
        // initialize Mirror Implementation
        mirrorImpl.load(object);

        // Initialize the page once the mirror implementation has been loaded
        // Test if current page is a chapter page (according to mirror implementation)
        if (!mirrorImpl.get().isCurrentPageAChapterPage(document, window.location.href)) {
            console.log("Current page is not recognize as a chapter page by mirror implementation");
            return;
        }
        // Retrieve informations relative to current chapter / manga read
        let data = await mirrorImpl.get().getInformationsFromCurrentPage(document, window.location.href)
        console.log("Informations for current page loaded : ");
        console.log(data);
        // Initialize pageData state
        pageData.load(data);

        let imagesUrl = [];
        if (options.displayChapters == 1) { // if display book
            // retrieve images to load (before doSomethingBeforeWritingScans because it can harm the source of data)
            imagesUrl = await mirrorImpl.get().getListImages(document, window.location.href);
            console.log(imagesUrl.length + " images to load");
        }

        initReader(imagesUrl)

        // mark manga as read
        if (options.markwhendownload === 0) {
            reading.consultManga()
        }
    }

    /**
     * This function is called when an abstraction is loaded
     */
    window["registerAbstractImplementation"] = function (mirrorName) {
        // do nothing there, the abstract object is loaded on the window and referenced by its name
    }

    /** Function called through executeScript when context menu button invoked */
    window["clickOnBM"] = function(src) {
    }
}

/**
 * This class replaces the current page by a custom reader, AMR Reader
 *  - No more glitches depending on the online reader css
 *  - more options, resize fit height, width
 */
function initReader(images) {
    document.body.innerHTML = ""; //empty the dom page
    let amrdiv = document.createElement("div")
    amrdiv.id = "app"
    document.body.appendChild(amrdiv)
    
    removeStyles()

    document.body.style.backgroundColor = "#424242"
    loadCss("https://fonts.googleapis.com/css?family=Roboto:300,400,500,700")
    loadCss("https://cdn.materialdesignicons.com/3.0.39/css/materialdesignicons.min.css")
    
    // Load vue
    Vue.config.productionTip = false
    Vue.use(Vuetify, { theme: theme, iconfont: 'mdi' })
    new Vue({
        el: amrdiv,
        render: h => h(AmrReader, { props: {images: images} })
    });
}

function removeStyles() {
    let stylesheets = document.getElementsByTagName('link'), i, sheet;
    for(i in stylesheets) {
        if (stylesheets.hasOwnProperty(i)) {
            sheet = stylesheets[i];
            console.log(sheet)
            console.log(sheet.getAttribute("rel"))
            console.log(sheet.getAttribute("type"))
            if((sheet.getAttribute("rel") && sheet.getAttribute("rel") == "stylesheet") || (sheet.getAttribute('type') && sheet.getAttribute('type').toLowerCase() == 'text/css')) {
                console.log("-->remove")
                sheet.parentNode.removeChild(sheet);
            }
        }
    }
    //let styles = document.getElementsByTagName('style'), st;
    /*for(i in styles) {
        if (stylesheets.hasOwnProperty(i)) {
            st = styles[i];
            console.log(st)
            st.parentNode.removeChild(st);
        }
    }*/
}
function loadCss(file) {
    var link = document.createElement( "link" )
    link.href = file
    link.type = "text/css"
    link.rel = "stylesheet"
    link.media = "screen,print"

    document.getElementsByTagName( "head" )[0].appendChild( link )
}