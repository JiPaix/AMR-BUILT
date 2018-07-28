import 'regenerator-runtime/runtime';
import browser from "webextension-polyfill";
import options from './options';
import mirrorImpl from './mirrorimpl'
import pageData from './pagedata'
import util from './util';
import i18n from '../amr/i18n';

class Reading {
    consultManga() {
        browser.runtime.sendMessage({
            "action": "readManga",
            "url": pageData.currentMangaURL,
            "mirror": mirrorImpl.get().mirrorName,
            "lastChapterReadName": pageData.currentChapter,
            "lastChapterReadURL": pageData.currentChapterURL,
            "name": pageData.name
        });
    }

    async createBook(imagesUrl) {
        if (options.displayChapters == 1) { // display as a book
            let where = mirrorImpl.get().whereDoIWriteScans(document, window.location.href);
            pageData.whereScans = where;
            //Get specific mode for currentManga
            let curmode = -1;
            let specific = await browser.runtime.sendMessage({ action: "mangaInfos", url: pageData.currentMangaURL });
            if (specific !== null && specific.display) {
                curmode = specific.display;
            }
            //If not use default options mode
            if (curmode == -1) {
                curmode = options.displayMode;
            }
            this.writeImages(where, imagesUrl, curmode);
        }
    }

    writeImages(where, list, mode) {
        let table = $("<table class='AMRtable'></table>");
        table.css("text-align", "center");
        table.css("position", "static");
        table.css("width", "100%");
        table.appendTo(where);

        for (let i = 0; i < list.length; i++) {
            let tr = $("<tr></tr>");
            tr.appendTo(table);
            let td = $("<td></td>");
            td.css("text-align", "center");
            td.appendTo(tr);

            let spanner = $("<div class='spanForImg'></div>");
            $(spanner).css("vertical-align", "middle");
            $(spanner).css("text-align", "center");
            $(spanner).data("order", i);
            spanner.appendTo(td);

            let div = $("<div id='loader" + i + "' class='divLoading'></div>");
            div.css("background", "url(" + browser.extension.getURL("icons/loading.gif") + ") no-repeat center center");
            div.appendTo(spanner);

            // Using jQuery to create this image instead of DOM native method fix a
            //weird bug on canary and only some websites.
            //My thought is that a version of canary was mistaking the embedded jQuery
            //on the website and when the extension creates image from DOM and container
            //from website's jQuery. We can't have both of them interract (DOM restriction)
            //It might be a Canary issue more than an AMR issue... Here it is fixed...
            let img = new Image();

            $(img).addClass("imageAMR");
            $(img).data("owidth", img.offsetWidth);
            $(img).data("divLoad", "loader" + i);
            $(img).data("idScan", i);
            this.loadImageAMR(where, list[i], img, i, mode);
            $(img).appendTo(spanner);
        }

        let title = $("title").text();
        this.waitForImages(where, mode, title);
    }
    async onLoadImage(img) {
        if ($(img).data("canvasId")) {
            // This mode is no more used... was used when some websites did not display a scan to read but a canvas with parts of image on it...
            let width, height;
            let ancCan = $("#" + $(img).data("canvasId"));

            let resize = $(img).data("resize");
            let mode = $(img).data("modedisplay");

            if (resize == 1) {
                if (ancCan.width() < ancCan.height()) {
                    if (mode != 1) {
                        if (ancCan.width() > (screen.width - 200) / 2) {
                            width = (screen.width - 200) / 2;
                        } else {
                            width = ancCan.width();
                        }
                    } else {
                        if (ancCan.width() > (screen.width - 200)) {
                            width = (screen.width - 200);
                        } else {
                            width = ancCan.width();
                        }
                    }
                } else {
                    if (ancCan.width() > (screen.width - 200)) {
                        width = (screen.width - 200);
                    } else {
                        width = ancCan.width();
                    }
                }
            } else {
                width = ancCan.width();
            }
            height = (width / ancCan.width()) * ancCan.height();

            //DIV VERSION
            $("div", ancCan).add($("div > img", ancCan)).each(function (index) {
                //FIX CONFLICT WITH AdBlock -->
                let wori = $(this).width();
                if (wori === 0) {
                    //console.log("zero width img to " + $(this).data("width"));
                    wori = $(this).data("width");
                }
                let hori = $(this).height();
                if (hori === 0) {
                    //console.log("zero height img to " + $(this).data("height"));
                    hori = $(this).data("height");
                }
                //---
                let w = Math.floor((width / ancCan.width()) * wori) + 1;
                let h = Math.floor((width / ancCan.width()) * hori) + 1;

                $(this).css("width", w + 'px');
                $(this).css("height", h + 'px');
                if ($(this).css("position") == "absolute") {
                    let l = Math.floor((width / ancCan.width()) * $(this).position().left);
                    if (l !== 0) l++;
                    let t = Math.floor((width / ancCan.width()) * $(this).position().top);
                    if (t !== 0) t++;
                    $(this).css("left", l + 'px');
                    $(this).css("top", t + 'px');
                }
            });

            $(ancCan).css("width", width + 'px');
            $(ancCan).css("height", height + 'px');

            $(ancCan).css("margin-bottom", "50px");
            $(ancCan).css("border", "5px solid white");
            $("#" + $(img).data("divLoad")).css("display", "none");
            $(img).data("finish", "1");
            $(img).css("display", "none");

            //Bookmark DIV MOD ??? MODE CANVAS NOT USED ANYMORE
        } else {
            $("#" + $(img).data("divLoad")).css("display", "none");
            $(img).data("finish", "1");
            $(img).css("margin-right", "10px");
            if ($(img).attr("src") != browser.extension.getURL("icons/imgerror.png")) {
                $(img).css("border", "5px solid white");
                $(img).css("margin-bottom", "50px");
            }

            //Create contextual menu to bookmark image
            browser.runtime.sendMessage({
                action: "createContextMenu",
                lstUrls: [$(img).attr("src")]
            });
            //Check bookmarks
            let objBM = {
                action: "getBookmarkNote",
                mirror: mirrorImpl.get().mirrorName,
                url: pageData.currentMangaURL,
                chapUrl: pageData.currentChapterURL,
                type: "scan",
                scanUrl: $(img).attr("src"),
                scanName: $(img).data("idScan")
            };
            let result = await browser.runtime.sendMessage(objBM);
            if (result.isBooked) {
                let imgScan = $(".spanForImg img[src='" + result.scanSrc + "']");
                if (imgScan.size() === 0) {
                    imgScan = $(".spanForImg img[src='" + decodeURI(result.scanSrc) + "']");
                }
                imgScan.data("note", result.note);
                imgScan.data("booked", 1);
                if (result.note !== "") imgScan.attr("title", "Note : " + result.note);
                imgScan.css("border-color", "#999999");
            }
            if (options.autobm) {
                $(img).dblclick(function () {
                    let obj;
                    if ($(this).data("booked")) {
                        obj = {
                            action: "deleteBookmark",
                            mirror: mirrorImpl.get().mirrorName,
                            url: pageData.currentMangaURL,
                            chapUrl: pageData.currentChapterURL,
                            type: "scan"
                        };
                        obj.scanUrl = $(this).attr("src");

                        $(this).css("border-top-color", "white");
                        $(this).css("border-right-color", "white");
                        $(this).css("border-bottom-color", "white");
                        $(this).css("border-left-color", "white");
                        $(this).removeAttr("title");
                        $(this).removeData("booked");
                        $(this).removeData("note");

                        browser.runtime.sendMessage(obj);
                    } else {
                        obj = {
                            action: "addUpdateBookmark",
                            mirror: mirrorImpl.get().mirrorName,
                            url: pageData.currentMangaURL,
                            chapUrl: pageData.currentChapterURL,
                            type: "scan",
                            name: pageData.name,
                            chapName: pageData.currentChapter
                        };
                        obj.scanUrl = $(this).attr("src");
                        obj.scanName = $(this).data("idScan");
                        obj.note = "";

                        $(this).css("border-color", "#999999");
                        $(this).data("note", "");
                        $(this).data("booked", 1);

                        browser.runtime.sendMessage(obj);
                    }
                });
            }
        }
        let divNum = $("<div class='pagenumberAMR'><div class='number'>" + ($(img).data("idScan") + 1) + "</div></div>");
        divNum.appendTo($(img).closest(".spanForImg"));
    }

    clickOnBM(src) {
        let imgScan = $(".spanForImg img[src='" + src + "']");
        if (imgScan.size() === 0) {
            imgScan = $(".spanForImg img[src='" + decodeURI(src) + "']");
        }

        pageData.curbookmark.type = "scan";
        pageData.curbookmark.scanUrl = src;
        pageData.curbookmark.scanName = imgScan.data("idScan");

        if (imgScan.data("note") !== undefined) {
            $("#noteAMR").val(imgScan.data("note"));
        } else {
            $("#noteAMR").val("");
        }
        if (imgScan.data("booked")) {
            $("#delBtnAMR").show();
        } else {
            $("#delBtnAMR").hide();
        }

        $("#bookmarkPop").modal({ focus: false, onShow: this.showDialog, zIndex: 10000000 });

    }

    onErrorImage(img) {
        let reading = this;
        $(img).css("margin-bottom", "50px");
        $(img).css("margin-right", "10px");
        if (img.naturalWidth === 0) {
            //Here, number of tries before considering image can not be loaded
            if ($(img).data("number") == 4) {
                console.error("Image has not been recovered");
                $(img).attr("src", browser.extension.getURL("icons/imgerror.png"));
                $(img).css("border", "0");
                $(img).css("margin", "0");
                $(img).data("finish", "1");
                $("#" + $(img).data("divLoad")).css("display", "none");

                //Create the reload button
                let butReco = $("<a class='buttonAMR'>" + i18n("content_read_reload") + "</a>");
                butReco.css("display", "block");
                butReco.css("max-width", "200px");
                butReco.css("margin-left", "auto");
                butReco.css("margin-right", "auto");
                $(img).after(butReco);
                butReco.click(function () {
                    let imgAnc = $(this).prev();
                    let url = $(imgAnc).data("urlToLoad");
                    let divLoadId = $(imgAnc).data("divLoad");
                    let idScan = $(imgAnc).data("idScan");
                    let spanner = $(this).parent();
                    spanner.empty();

                    let nimg = new Image();
                    //== loadImage
                    $(nimg).data("urlToLoad", url);
                    $(nimg).css("border", "5px solid white");
                    $(nimg).load(() => reading.onLoadImage(nimg));
                    $(nimg).error(() => reading.onErrorImage(nimg));
                    mirrorImpl.get().getImageFromPageAndWrite(util.removeProtocol(url), nimg, document, window.location.href);

                    $(nimg).appendTo(spanner);

                    let div = $("<div id='" + divLoadId + "' class='divLoading'></div>");
                    div.css("background", "url(" + browser.extension.getURL("icons/loading.gif") + ") no-repeat center center");
                    $(nimg).data("divLoad", divLoadId);
                    $(nimg).data("idScan", idScan);
                    div.appendTo(spanner);
                });

            } else {
                util.debug("An image has encountered a problem while loading... All Mangas Reader is trying to recover it...");
                let imgSave = new Image();

                if ($(img).data("hasErrors") != "1") {
                    $(imgSave).data("hasErrors", "1");
                    $(imgSave).data("number", 1);
                } else {
                    $(imgSave).data("hasErrors", "1");
                    $(imgSave).data("number", $(img).data("number") + 1);
                }

                $(imgSave).data("divLoad", $(img).data("divLoad"));
                $(imgSave).data("idScan", $(img).data("idScan"));

                //== loadImage
                $(imgSave).data("urlToLoad", $(img).data("urlToLoad"));
                $(imgSave).css("border", "5px solid white");
                $(imgSave).addClass("imageAMR");
                $(imgSave).load(() => reading.onLoadImage(imgSave));
                $(imgSave).error(() => reading.onErrorImage(imgSave));
                mirrorImpl.get().getImageFromPageAndWrite($(img).data("urlToLoad"), imgSave, document, window.location.href);

                $(img).after($(imgSave));
                $(img).remove();
            }
        } else {
            $("#" + $(img).data("divLoad")).css("display", "none");
            $(img).data("finish", "1");
            $(img).data("error", "1");
        }
    }

    loadImageAMR(where, url, img, pos, mode, second) {
        if (!second) {
            $(img).data("urlToLoad", url);
            $(img).data("resize", options.resize);
            $(img).data("modedisplay", mode);

            $(img).load(() => this.onLoadImage(img));
            $(img).error(() => this.onErrorImage(img));
        }

        if (options.imgorder == 1) {
            if (this.nbLoaded(where) == pos) {
                mirrorImpl.get().getImageFromPageAndWrite(util.removeProtocol(url), img, document, window.location.href);
            } else {
                var _self = this;
                setTimeout(function () {
                    _self.loadImageAMR(where, url, img, pos, mode, true);
                }, 100);
            }
        } else {
            mirrorImpl.get().getImageFromPageAndWrite(util.removeProtocol(url), img, document, window.location.href);
        }
    }

    nbLoaded(where) {
        let nbOk = 0;
        $(".imageAMR", where).each(function (index) {
            if ($(this).data("finish") == "1") {
                nbOk++;
            }
        });
        return nbOk;
    }

    waitForImages(where, mode, title) {
        let isOk = true;
        let nbOk = 0;
        let nbTot = 0;
        $(".imageAMR", where).each(function (index) {
            if ($(this).data("finish") != "1") {
                isOk = false;
            } else {
                nbOk++;
            }
            if (this.offsetWidth != $(this).data("owidth")) {
                $("#" + $(this).data("divLoad")).css("display", "none");
            }
            nbTot++;
        });
        if (options.load == 1) {
            if (nbTot !== 0) {
                $("title").text(Math.floor(nbOk / nbTot * 100) + " % - " + title);
            }
        }
        if (isOk) {
            util.debug("finish loading images");
            this.transformImagesInBook(where, mode);
            mirrorImpl.get().doAfterMangaLoaded(document, window.location.href);
            $("title").text(title);
            if (pageData.nexturltoload && options.prefetch == 1) {
                this.loadNextChapter(pageData.nexturltoload);
            }
            if (options.markwhendownload === 1 && options.addauto === 1) {
                this.consultManga();
            }
        } else {
            let reading = this;
            setTimeout(function () {
                reading.waitForImages(where, mode, title);
            }, 500);
        }
    }

    isLandscape(img) {
        if ($(img).data("canvasId")) {
            let can = $("#" + $(img).data("canvasId"));
            return can.width() > can.height();
        } else {
            if (parseInt($(img).css("width"), 10) > parseInt($(img).css("height"), 10)) {
                return true;
            }
            return false;
        }
    }

    transformImagesInBook(where, mode) {
        //mode = 1 --> images are displayed on top of one another
        //mode = 2 --> images are displayed two by two occidental reading mode
        //mode = 3 --> images are displayed two by two japanese reading mode

        let nbSinglePages = 0;
        let posImg = [];
        let isFirstDouble = true;
        let isEven = true;
        let reading = this;

        util.debug("Transformation book -> Nombre d'images :" + $(".imageAMR", where).size());
        $(".imageAMR", where).sort(function (a, b) {
            let nba = $(a).closest(".spanForImg").data("order");
            let nbb = $(b).closest(".spanForImg").data("order");
            return ((nba < nbb) ? -1 : ((nba == nbb) ? 0 : 1));
        }).each(function (index) {
            //console.log("setting image position...");
            if (reading.isLandscape(this)) {
                posImg[index] = 2;
                if (reading.isLandscape(this) && isFirstDouble) {
                    if (index !== 0 && posImg[index - 1] != 1) {
                        for (let i = 0; i < posImg.length; i++) {
                            if (posImg[i] != 2) {
                                posImg[i] = (posImg[i] + 1) % 2;
                            }
                        }
                    }
                    isFirstDouble = false;
                }
                isEven = true;
            } else {
                if (index == $(".imageAMR", where).size() - 1 && isEven) {
                    posImg[index] = 2;
                } else {
                    posImg[index] = isEven ? 0 : 1;
                    isEven = !isEven;
                }
            }
        });

        let parity = nbSinglePages % 2;

        $(where).css("text-align", "center");
        let evenImg = null;
        let tableRes = $("<table class='AMRtable'></table>");
        tableRes.css("width", "100%");
        tableRes.css("position", "static");

        $(".spanForImg", where).sort(function (a, b) {
            let nba = $(a).data("order");
            let nbb = $(b).data("order");
            return ((nba < nbb) ? -1 : ((nba == nbb) ? 0 : 1));
        }).each(function (index) {
            let divMode = ($("div > img", this).data("canvasId"));
            //console.log("displaying image position...");
            let td = $("<td></td>");

            if (!divMode) {
                if ($("img:first-child", this).attr("src") != browser.extension.getURL("icons/imgerror.png")) {
                    $("img:first-child", this).css("margin-bottom", "50px");
                    td.css("vertical-align", "middle");
                }
            }
            $(this).appendTo(td);

            //console.log("Displaying " + $("img:first-child", this).data("urlToLoad") + " in the table");
            let trTmp;
            if (posImg[index] == 2 || mode == 1) {
                if (evenImg !== null) {
                    let trForEven = $("<tr></tr>");
                    trForEven.appendTo(tableRes);
                    evenImg.appendTo(trForEven);
                    evenImg.attr("colspan", "2");
                    evenImg = null;
                    if (options.resize == 1) {
                        if (!divMode) $("img", trForEven).css("max-width", (screen.width - 200) + 'px');
                    }
                }
                trTmp = $("<tr></tr>");
                trTmp.appendTo(tableRes);
                td.attr("colspan", "2");
                td.appendTo(trTmp);
                if (options.resize == 1) {
                    if (!divMode) $("img", trTmp).css("max-width", (screen.width - 200) + 'px');
                }
            } else {
                if (evenImg !== null) {
                    trTmp = $("<tr></tr>");
                    trTmp.appendTo(tableRes);
                    if (mode == 2) {
                        evenImg.appendTo(trTmp);
                        evenImg.css("text-align", "right");
                        td.appendTo(trTmp);
                        td.css("text-align", "left");
                    } else {
                        td.appendTo(trTmp);
                        td.css("text-align", "right");
                        evenImg.appendTo(trTmp);
                        evenImg.css("text-align", "left");
                    }
                    if (options.resize == 1) {
                        if (!divMode) $("img", trTmp).css("max-width", ((screen.width - 200) / 2) + 'px');
                    }
                    evenImg = null;
                } else {
                    if (posImg[index] === 0) {
                        evenImg = td;
                    } else {
                        trTmp = $("<tr></tr>");
                        trTmp.appendTo(tableRes);
                        td.attr("colspan", "2");
                        td.appendTo(trTmp);
                        if (options.resize == 1) {
                            if (!divMode) $("img", trTmp).css("max-width", ((screen.width - 200) / 2) + 'px');
                        }
                    }
                }

            }
        });

        let divMode = ($("img:first-child", this).data("canvasId"));

        if (!divMode) {
            let td = $("<td></td>");
            $("img:first-child", this).css("margin-bottom", "50px");
            $("img:first-child", this).css("margin-right", "10px");
            $("img:first-child", this).appendTo(td);
        }
        if (evenImg !== null) {
            let trTmp = $("<tr></tr>");
            trTmp.appendTo(tableRes);
            if (mode == 2) {
                evenImg.appendTo(trTmp);
                evenImg.css("text-align", "right");
                td.appendTo(trTmp);
                td.css("text-align", "left");
            } else {
                td.appendTo(trTmp);
                td.css("text-align", "right");
                evenImg.appendTo(trTmp);
                evenImg.css("text-align", "left");
            }
            if (options.resize == 1) {
                if (!divMode) $("img", trTmp).css("max-width", ((screen.width - 200) / 2) + 'px');
            }
            evenImg = null;
        }

        $("table", where).remove();
        tableRes.appendTo(where);
    }

    async loadNextChapter(urlNext) {
        util.debug("Loading next chapter...");
        // load an iframe with urlNext and get list of images
        let resp = await browser.runtime.sendMessage({
            action: "getNextChapterImages",
            url: urlNext,
            mirrorName: mirrorImpl.get().mirrorName
        });
        let lst = resp.images;
        if (lst !== null) {
            util.debug(lst.length + "... scans to load");
            for (let i = 0; i < lst.length; i++) {
                let img = new Image();
                $(img).data("attempts", 0);
                $(img).data("id", i);
                $(img).data("urltoload", lst[i]);
                $(img).data("urlnext", urlNext);
                $(img).data("total", lst.length);
                $(img).load(() => this.onLoadNextImage());
                $(img).error(() => this.onErrorNextImage());
                mirrorImpl.get().getImageFromPageAndWrite(lst[i], img, document, urlNext);
            }
        } else {
            util.debug("no scans found for next chapter...");
        }
    }

    onLoadNextImage() {
        let lstbtn = [];
        let id = "nChapBtn";
        let i = 0;
        while ($("#" + id + i).size() > 0) {
            lstbtn[lstbtn.length] = $("#" + id + i);
            i++;
        }
        let _self = this;
        $.each(lstbtn, function (index) {
            if ($(this).data("nbloaded")) {
                $(this).data("nbloaded", $(this).data("nbloaded") + 1);
            } else {
                $(this).data("nbloaded", 1);
            }
            let prog;
            if ($(".AMRprogress", $(this)).size() === 0) {
                prog = $("<span class='buttonAMR AMRprogress'></span>");
                prog.css("position", "relative");
                prog.css("top", "0");
                prog.css("left", "0");
                prog.css("width", "0px");
                prog.css("height", "4px");
                prog.css("border-radius", "2px");
                prog.css("border-radius", "2px");
                prog.css("background-color", "#8888EE");
                prog.css("opacity", "1");
                prog.css("display", "block");

                prog.appendTo($(this));
            } else {
                prog = $(".AMRprogress", $(this));
            }
            prog.css("width", (this[0].offsetWidth * ($(this).data("nbloaded") / $(_self).data("total"))) + "px");
        });
    }

    onErrorNextImage() {
        // do not retry... (will be retried 3 times when loaded for real)
    }
}
export default (new Reading);