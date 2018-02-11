const fetch = require('node-fetch');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');
const asciify = require('asciify');
const clc = require('cli-color');

let pPage = 0
let pOffer = 0
const URL_PAGE = 'https://www.civiweb.com/FR/offre-liste/page/';
const URL_OFFER = 'https://www.civiweb.com'
const outputPath = './Civiweb-' + moment().format('YYYYMMDDHHmmss') + '.csv';
//MaxPage=205 on 10/10/2017
//If nPageIsMaxPage is true, nPage is overload with the real maximum number of filled pages on civiweb.
const nPageIsRealMaxPage = true;
let nPage = 205

let main = async () => {
    let start = moment();
    await printAscii('Civiweb')
    await printAscii('Scraper')
    if (nPageIsRealMaxPage) {
        nPage = await getMaxPage();
    }
    let promisePageUrls = ([...Array(nPage).keys()].map(el => getOfferLinks(URL_PAGE + el + '.aspx')
        .then((res) => {
            progress(++pPage, nPage);
            return res;
        })))
    console.log(clc.xterm(93).bold('\n#COLLECTING OFFERS URL...'))
    let offerUrls = await Promise.all(promisePageUrls).then((res) => {
        res = res.reduce((acc, cur) => {
            return acc.concat(cur)
        }, [])
        let offerUrls = [...new Set(res)];
        return offerUrls;
    });
    let nOffer = offerUrls.length;
    let promiseOfferUrls = offerUrls.map(el => getOffer(URL_OFFER + el)
        .then((res) => {
            progress(++pOffer, nOffer);
            return res;
        }));
    console.log(clc.xterm(93).bold('\n#GETTING OFFERS DATAS...'))
    let offers = await Promise.all(promiseOfferUrls)
    console.log(clc.xterm(93).bold('\n#WRITTING OUTPUT FILE...'))
    writeFile(createCsv(offers));
    console.log(clc.xterm(163)("file " + outputPath + " written with success!\n"));
    console.log(clc.xterm(37)(nOffer + ' offers collected in ' + moment().diff(start, 'ms') + ' ms\n'));
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

let getOfferLinks = async (pageUrl) => {
    let htmlPage = await fetch(pageUrl).then(res => res.text());
    let $ = cheerio.load(htmlPage);
    let offerLinks = [];
    $(".xt_offrelink").map(function () {
        offerLinks.push($(this).attr('href'));
    })
    return offerLinks;
};

let progress = (count, tot) => {
    if (count > 1) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
    }
    if (count == tot) {
        process.stdout.write(clc.xterm(163)(((count / tot) * 100).toFixed(0) + ' % (' + count + '/' + tot + ')'));
        process.stdout.write("\n");
    } else {
        process.stdout.write(clc.xterm(163)(((count / tot) * 100).toFixed(0) + ' % (' + count + '/' + tot + ')'));
    }
}

let getOffer = async (offerUrl) => {
    let htmlPage = await fetch(offerUrl).then(res => res.text());
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

let createCsv = (offers) => {
    offers = offers.sort((a, b) => {
        return b.salary - a.salary
    })
    return offers.map((el) => {
        return el.salary + ' ; ' + el.city + ' ; ' + el.months + ' ; ' + el.orga + ' ; ' + el.compet + ' ; ' + el.start + ' ; ' + el.publish + ' ; ' + el.url
    }).join('\n')
}

let writeFile = (str) => {
    if (!fs.existsSync(outputPath)) {
        fs.writeFileSync(outputPath, '');
    }
    fs.appendFile(outputPath, str, 'ascii', function (err) {
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

main();