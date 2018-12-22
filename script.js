const fetch = require('node-fetch');
const cheerio = require('cheerio');
const readline = require('readline');
const moment = require('moment');
const fs = require('fs');
const asciify = require('asciify');
const clc = require('cli-color');

var pPage = 0
var pOffer = 0
var nOffer = 0
var nErrOffer = 0
var nErrPage = 0
var lastProgress = new Date()

const URL_PAGE = 'https://www.civiweb.com/FR/offre-liste/page/';
const URL_OFFER = 'https://www.civiweb.com'
const outputPath = './Civiweb-' + moment().format('YYYYMMDDHHmmss') + '.csv';
//MaxPage=205 on 10/10/2017
//If nPageIsMaxPage is true, nPage is overload with the real maximum number of filled pages on civiweb.
const nPageIsRealMaxPage = true;
var nPage = 3

var OFFERS = []
var START = moment();

let main = async () => {

    await printAscii('Civiweb')
    await printAscii('Scraper')
    if (nPageIsRealMaxPage) {
        nPage = await getMaxPage();
    }

    console.log(clc.xterm(93).bold('\n#COLLECTING OFFERS URL...'))
    let promisePageUrls = ([...Array(nPage).keys()].map(el => getOfferLinks(URL_PAGE + el + '.aspx')))

    //SYNCHRONE
    let offerUrls = []; for (let promisePageUrl of promisePageUrls) { offerUrls.push(...await promisePageUrl) }

    //ASYNCHRONE
    //let offerUrls = (await Promise.all(promisePageUrls)).reduce((acc, curr) => { acc.push(...curr); return acc }, [])

    offerUrls = [...new Set(offerUrls)];
    nOffer = offerUrls.length;

    console.log(clc.xterm(93).bold('\n#GETTING OFFERS DATAS...'))
    let promiseOfferUrls = offerUrls.map(el => getOffer(URL_OFFER + el))

    //SYNCHRONE
    for (let promiseOfferUrl of promiseOfferUrls) { OFFERS.push(await promiseOfferUrl) }

    //ASYNCHRONE
    //OFFERS = await Promise.all(promiseOfferUrls)

    exit()

}

let getOfferLinks = async (pageUrl) => {
    let htmlPage = ""
    //for (var i = 0; i < 10; i++) {
    while (htmlPage == "") {
        try {
            htmlPage = await fetch(pageUrl)
            htmlPage = await htmlPage.text()
        } catch (error) {
            await progress(pPage, nPage, ++nErrPage)
            htmlPage = ""
        }
    }
    await progress(++pPage, nPage, nErrPage)
    let $ = cheerio.load(htmlPage);
    let offerLinks = [];
    $(".xt_offrelink").map(function () {
        offerLinks.push($(this).attr('href'));
    })
    return offerLinks;
};

let getOffer = async (offerUrl) => {
    let htmlPage = ""
    try {
        htmlPage = await fetch(offerUrl)
        htmlPage = await htmlPage.text()
    } catch (error) {
        await progress(pOffer, nOffer, ++nErrOffer)
        htmlPage = ""
    }
    await progress(++pOffer, nOffer, nErrOffer)
    let $ = cheerio.load(htmlPage);
    let offer = {};
    let salary = Number($("#ContenuPrincipal_BlocA1_m_oIndemnite").text().substring(0, 4));
    let city = $("#ContenuPrincipal_BlocA1_m_oCity").text();
    let months = $("#ContenuPrincipal_BlocA1_m_oNumberOfMonths").text();
    let start = $("#ContenuPrincipal_BlocA1_m_oStartDate").text();
    let orga = $("#ContenuPrincipal_BlocA1_m_oOrganization").text();
    let publish = $("#ContenuPrincipal_BlocB1_m_oPublicationDate").text();
    let compet = $("#ContenuPrincipal_BlocB1_m_oCompetence").text();
    offer.url = offerUrl;
    offer.salary = salary;
    offer.city = city;
    offer.months = months;
    offer.start = start;
    offer.orga = orga;
    offer.publish = publish;
    offer.compet = compet;
    return offer;
}

let exit = (isBlocked = false) => {
    if (isBlocked) { console.log(clc.xterm(93).bold('\n\nTimeout!')) }
    console.log(clc.xterm(93).bold('\n#WRITTING OUTPUT FILE...'))
    writeFile(createCsv(OFFERS));
    console.log(clc.xterm(163)("file " + outputPath + " written with success!\n"));
    console.log(clc.xterm(37)(OFFERS.length + ' OFFERS collected in ' + moment().diff(START, 'ms') + ' ms\n'));
    process.exit();
}

let checkProgress = () => {
    let now = new Date()
    if (now - lastProgress > 40 * 1000) {
        exit(true)
    }
}

let getMaxPage = async () => {
    let htmlPage = await fetch(URL_PAGE + '8000' + '.aspx').then(res => res.text());
    let $ = cheerio.load(htmlPage);
    let span = []
    $(".pagination").children().map(function () {
        span.push($(this).text());
    })
    return Number(span[span.length - 1])
}

let progress = (count, tot, err) => {
    return new Promise((resolve, reject) => {
        lastProgress = new Date()
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
        if (count == tot) {
            process.stdout.write(clc.xterm(163)(((count / tot) * 100).toFixed(0) + ' % (' + count + '/' + tot + ') [' + err + ']'));
            process.stdout.write("\n");
        } else {
            process.stdout.write(clc.xterm(163)(((count / tot) * 100).toFixed(0) + ' % (' + count + '/' + tot + ') [' + err + ']'));
        }
        resolve()
    })
}

let msleep = (n) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}
let sleep = (n) => {
    msleep(n * 1000);
}

let createCsv = (OFFERS) => {
    OFFERS = OFFERS.sort((a, b) => {
        return b.salary - a.salary
    })
    return OFFERS.map((el) => {
        return el.salary + ' ; ' + el.city + ' ; ' + el.months + ' ; ' + el.orga + ' ; ' + el.compet + ' ; ' + el.start + ' ; ' + el.publish + ' ; ' + el.url
    }).join('\n')
}

let writeFile = (str) => {
    if (!fs.existsSync(outputPath)) {
        fs.writeFileSync(outputPath, '');
    }
    fs.appendFileSync(outputPath, str, 'ascii', function (err) {
        if (err) {
            return console.log(err);
        }
    });
}

let printAscii = (text) => {
    return new Promise((resolve, reject) => {
        asciify(text, (err, res) => {
            console.log(clc.blueBright.bold(res));
            resolve('welcome')
        });
    })
}

setInterval(checkProgress, 10 * 1000);
main();
