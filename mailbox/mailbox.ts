// ==UserScript==
// @name           Virtonomica: mailbox
// @namespace      https://github.com/ra81/mailbox
// @version 	   1.03
// @description    Фильтрация писем в почтовом ящике
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/system
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/inbox
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/outbox
// ==/UserScript==

//debugger;а

interface TNameValueCount {
    Name: string;
    Value: string;
    Count: number
}
interface IMail {
    $row: JQuery;
    From: string;
    To: string;
    Date: Date;
    Subj: string;
}
interface IFilterOptions {
    From: string;
    To: string;
    DateStr: string;
    SubjRx: string;
}
interface IDictionary<T> {
    [key: string]: T;
}

function run() {
    let $ = jQuery;
    let realm = getRealm();

    // закончить если мы не на той странице
    //let pathRx = new RegExp(/\/([a-zA-Z]+)\/main\/company\/view\/\d+(?:\/unit_list\/?)?$/ig);
    //if (pathRx.test(document.location.pathname) === false) {
    //    console.log("management: not on unit list page.");
    //    return;
    //}

    // работа
    let $mailTable = $("table.grid");
    let $rows = $mailTable.find("tr.even, tr.odd").closest("tr");
    let mails = parseRows($rows);

    // создаем панельку, и шоутайм.
    let $panel = buildFilterPanel(mails);
    $("form").before($panel);
    $panel.show();
    

    // Функции
    //
    // делает фильтрацию
    function doFilter($panel: JQuery) {

        let op = getFilterOptions($panel);
        let filterMask = filter(mails, op);

        for (let i = 0; i < mails.length; i++) {
            let mail = mails[i];

            if (filterMask[i])
                mail.$row.show();
            else
                mail.$row.hide();
        }
    }

    function buildFilterPanel(mails: IMail[]) {

        function buildOptions (items: TNameValueCount[]) {
            let optionsHtml = '<option value="all", label="all">all</option>';
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let lbl = item.Count > 1 ? `label="${item.Name} (${item.Count})"` : `label="${item.Name}"`;
                let val = `value="${item.Value}"`;
                let txt = item.Name;

                let html = `<option ${lbl} ${val}>${txt}</option>`;
                optionsHtml += html;
            }

            return optionsHtml;
        }

        // если панели еще нет, то добавить её
        let panelHtml = "<div id='filterPanel' style='padding: 2px; border: 1px solid #0184D0; border-radius: 4px 4px 4px 4px; float:left; white-space:nowrap; color:#0184D0; display:none;'></div>";
        let $panel = $(panelHtml);

        // фильтр по From
        let fromFilter = $("<select id='fromFilter' style='max-width:200px;'>");
        let froms = makeKeyValCount<IMail>(mails, (el) => el.From);
        fromFilter.append(buildOptions(froms));

        // фильтр по To
        let toFilter = $("<select id='toFilter' style='max-width:200px;'>");
        let tos = makeKeyValCount<IMail>(mails, (el) => el.To);
        toFilter.append(buildOptions(tos));

        // фильтр по Date. даты сортируем по убыванию для удобства
        let dateFilter = $("<select id='dateFilter' style='max-width:200px;'>");
        let dates = makeKeyValCount<IMail>(mails, (el) => el.Date.toLocaleDateString(), (el) => el.Date.toDateString());
        dates.sort((a, b) => {
            if (new Date(a.Value) > new Date(b.Value))
                return -1;

            if (new Date(a.Value) < new Date(b.Value))
                return 1;

                return 0;
        });
        dateFilter.append(buildOptions(dates));

        // текстовый фильтр
        let subjFilter = $('<input id="subjFilter" style="max- width:400px;"></input>').attr({ type: 'text', value: '' });

        // события смены фильтров
        //
        fromFilter.change(function () {
            doFilter($panel);
        });

        toFilter.change(function (this: HTMLSelectElement) {
            doFilter($panel);
        });

        dateFilter.change(function (this: HTMLSelectElement) {
            doFilter($panel);
        });

        // просто фильтруем.
        subjFilter.change(function () {
            doFilter($panel);
        });

        // дополняем панель до конца элементами
        //
        $panel.append("<span>From: </span>").append(fromFilter);
        $panel.append("<span> To: </span>").append(toFilter);
        $panel.append("<span> Date: </span>").append(dateFilter);
        $panel.append("<span> Subject: </span>").append(subjFilter);

        return $panel;
    }
}

function getFilterOptions($panel: JQuery): IFilterOptions {
    return {
        From: $panel.find("#fromFilter").val(),
        To: $panel.find("#toFilter").val(),
        DateStr: $panel.find("#dateFilter").val(),
        SubjRx: $panel.find("#subjFilter").val().toLowerCase(),
    }
}

function parseRows($rows: JQuery): IMail[] {

    let mails: IMail[] = [];

    //$("tr.even").eq(0).find("td:nth-child(2) a").last().text().trim()
    // есть тупо текстовые От, Кому например поддержка. Они не парсятся через "a"
    // Если письмо новое там добавляется еще "a" и уже 2 их
    let f = (i: number, e: Element) => {
        let $a = $(e).find("a:last-child");
        if ($a.length > 0)
            return $a.text().trim();

        return $(e).text();
    }
    let fDate = (i: number, e: Element) => {
        let $a = $(e).find("a:last-child");
        let txt = $(e).text();
        if ($a.length > 0)
            txt = $a.text().trim();

        // если у нас не разбивается то будет 1 элемент все равно. возможно пустой
        return extractDate(txt);
    }

    let from = $rows.find("td:nth-child(2)").map(f) as any as string[];
    let to = $rows.find("td:nth-child(3)").map(f) as any as string[];
    
    let date = $rows.find("td:nth-child(4)").map(fDate) as any as (Date|null)[];
    let subj = $rows.find("td:nth-child(5)").map(f) as any as string[];
    if (from.length !== to.length || from.length !== subj.length)
        throw new Error("Ошибка парсинга списка писем.");

    for (let i = 0; i < $rows.length; i++) {
        let $r = $rows.eq(i);

        mails.push({
            $row: $r,
            From: from[i].length > 0 ? from[i] : "system",
            To: to[i].length > 0 ? to[i] : "system",
            Date: date[i] != null ? date[i] as Date : new Date(),
            Subj: subj[i].length > 0 ? subj[i] : "no subject"
        });
    }

    return mails;
}

// вернет дату или null если нельзя извлечь
function extractDate(dateTimeStr: string): Date|null {
    // если у нас не разбивается то будет 1 элемент все равно. возможно пустой
    let items = dateTimeStr.split("-");
    if (items.length !== 2)
        return null;

    let dateStr = items[0].trim();
    if (dateStr.length === 0)
        return null;

    items = dateStr.split(" ");
    if (items.length !== 3)
        return null;

    let d = numberfy(items[0]);
    let m = month(items[1]);
    let y = numberfy(items[2]);
    if (d < 1 || m == null || y < 1)
        return null;

    return new Date(y, m, d);

    function month(str: string) {
        let mnth = ["янв", "февр", "мар", "апр", "май", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"];
        for (let i = 0; i < mnth.length; i++) {
            if (str.indexOf(mnth[i]) === 0)
                return i;
        }

        return null;
    }
}

function filter(items: IMail[], options: IFilterOptions) {

    let res: boolean[] = [];
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        res[i] = false;

        if (options.From != "all" && item.From != options.From)
            continue;

        if (options.To != "all" && item.To != options.To)
            continue;

        if (options.DateStr != "all" && item.Date.getTime() != (new Date(options.DateStr)).getTime())
            continue;

        if (item.Subj.match(new RegExp(options.SubjRx, "i")) == null)
            continue;

        res[i] = true;
    }

    return res;
}

function makeKeyValCount<T>(items: T[], keySelector: (el: T) => string, valueSelector?: (el: T) => string) {

    let res: IDictionary<TNameValueCount> = {};
    for (let i = 0; i < items.length; i++) {
        let key = keySelector(items[i]);
        let val = valueSelector ? valueSelector(items[i]) : key;

        if (res[key] != null)
            res[key].Count++;
        else
            res[key] = { Name: key, Value: val, Count: 1 };
    }

    let resArray: TNameValueCount[] = [];
    for (let key in res)
        resArray.push(res[key]);

    resArray.sort(function (a, b) {
        if (a.Name > b.Name)
            return 1;

        if (a.Name < b.Name)
            return -1;

        return 0;
    });

    return resArray;
}

function getRealm(): string | null {
    // https://*virtonomic*.*/*/main/globalreport/marketing/by_trade_at_cities/*
    // https://*virtonomic*.*/*/window/globalreport/marketing/by_trade_at_cities/*
    let rx = new RegExp(/https:\/\/virtonomic[A-Za-z]+\.[a-zA-Z]+\/([a-zA-Z]+)\/.+/ig);
    let m = rx.exec(document.location.href);
    if (m == null)
        return null;

    return m[1];
}

function numberfy(str: string): number {
    // возвращает либо число полученно из строки, либо БЕСКОНЕЧНОСТЬ, либо -1 если не получилось преобразовать.

    if (String(str) === 'Не огр.' ||
        String(str) === 'Unlim.' ||
        String(str) === 'Не обм.' ||
        String(str) === 'N’est pas limité' ||
        String(str) === 'No limitado' ||
        String(str) === '无限' ||
        String(str) === 'Nicht beschr.') {
        return Number.POSITIVE_INFINITY;
    } else {
        return parseFloat(str.replace(/[\s\$\%\©]/g, "")) || -1;
        //return parseFloat(String(variable).replace(/[\s\$\%\©]/g, "")) || 0; //- так сделано чтобы variable когда undef получалась строка "0"
    }
}

$(document).ready(() => run());
