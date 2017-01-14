// ==UserScript==
// @name           Virtonomica: mailbox
// @namespace      https://github.com/ra81/mailbox
// @version 	   1.01
// @description    Фильтрация писем в почтовом ящике
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/system
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/inbox
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/outbox
// ==/UserScript==
function run() {
    var $ = jQuery;
    var realm = getRealm();
    // закончить если мы не на той странице
    //let pathRx = new RegExp(/\/([a-zA-Z]+)\/main\/company\/view\/\d+(?:\/unit_list\/?)?$/ig);
    //if (pathRx.test(document.location.pathname) === false) {
    //    console.log("management: not on unit list page.");
    //    return;
    //}
    // работа
    var $mailTable = $("table.grid");
    var $rows = $mailTable.find("tr.even, tr.odd").closest("tr");
    var mails = parseRows($rows);
    // создаем панельку, и шоутайм.
    var $panel = buildFilterPanel(mails);
    $("form").before($panel);
    $panel.show();
    // Функции
    //
    // делает фильтрацию
    function doFilter($panel) {
        var op = getFilterOptions($panel);
        var filterMask = filter(mails, op);
        for (var i = 0; i < mails.length; i++) {
            var mail = mails[i];
            if (filterMask[i])
                mail.$row.show();
            else
                mail.$row.hide();
        }
    }
    function buildFilterPanel(mails) {
        function buildOptions(items) {
            var optionsHtml = '<option value="all", label="all">all</option>';
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var lbl = item.Count > 1 ? "label=\"" + item.Name + " (" + item.Count + ")\"" : "label=\"" + item.Name + "\"";
                var val = "value=\"" + item.Value + "\"";
                var txt = item.Name;
                var html = "<option " + lbl + " " + val + ">" + txt + "</option>";
                optionsHtml += html;
            }
            return optionsHtml;
        }
        // если панели еще нет, то добавить её
        var panelHtml = "<div id='filterPanel' style='padding: 2px; border: 1px solid #0184D0; border-radius: 4px 4px 4px 4px; float:left; white-space:nowrap; color:#0184D0; display:none;'></div>";
        var $panel = $(panelHtml);
        // фильтр по From
        var fromFilter = $("<select id='fromFilter' style='max-width:200px;'>");
        var froms = makeKeyValCount(mails, function (el) { return el.From; });
        fromFilter.append(buildOptions(froms));
        // фильтр по To
        var toFilter = $("<select id='toFilter' style='max-width:200px;'>");
        var tos = makeKeyValCount(mails, function (el) { return el.To; });
        toFilter.append(buildOptions(tos));
        // фильтр по Date. даты сортируем по убыванию для удобства
        var dateFilter = $("<select id='dateFilter' style='max-width:200px;'>");
        var dates = makeKeyValCount(mails, function (el) { return el.Date; });
        dates = dates.sort(function (a, b) {
            if (a.Name > b.Name)
                return -1;
            if (a.Name < b.Name)
                return 1;
            return 0;
        });
        dateFilter.append(buildOptions(dates));
        // текстовый фильтр
        var subjFilter = $('<input id="subjFilter" style="max- width:400px;"></input>').attr({ type: 'text', value: '' });
        // события смены фильтров
        //
        fromFilter.change(function () {
            doFilter($panel);
        });
        toFilter.change(function () {
            doFilter($panel);
        });
        dateFilter.change(function () {
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
function getFilterOptions($panel) {
    return {
        From: $panel.find("#fromFilter").val(),
        To: $panel.find("#toFilter").val(),
        Date: $panel.find("#dateFilter").val(),
        SubjRx: $panel.find("#subjFilter").val().toLowerCase(),
    };
}
function parseRows($rows) {
    var mails = [];
    //$("tr.even").eq(0).find("td:nth-child(2) a").last().text().trim()
    // есть тупо текстовые От, Кому например поддержка. Они не парсятся через "a"
    // Если письмо новое там добавляется еще "a" и уже 2 их
    var f = function (i, e) {
        var $a = $(e).find("a:last-child");
        if ($a.length > 0)
            return $a.text().trim();
        return $(e).text();
    };
    var fDate = function (i, e) {
        var $a = $(e).find("a:last-child");
        var txt = $(e).text();
        if ($a.length > 0)
            txt = $a.text().trim();
        // если у нас не разбивается то будет 1 элемент все равно. возможно пустой
        return extractDate(txt);
    };
    var from = $rows.find("td:nth-child(2)").map(f);
    var to = $rows.find("td:nth-child(3)").map(f);
    var date = $rows.find("td:nth-child(4)").map(fDate);
    var subj = $rows.find("td:nth-child(5)").map(f);
    if (from.length !== to.length || from.length !== subj.length)
        throw new Error("Ошибка парсинга списка писем.");
    for (var i = 0; i < $rows.length; i++) {
        var $r = $rows.eq(i);
        mails.push({
            $row: $r,
            From: from[i].length > 0 ? from[i] : "system",
            To: to[i].length > 0 ? to[i] : "system",
            Date: date[i] != null ? date[i] : "unknown",
            Subj: subj[i].length > 0 ? subj[i] : "no subject"
        });
    }
    return mails;
}
// вернет дату или null если нельзя извлечь
function extractDate(dateTimeStr) {
    // если у нас не разбивается то будет 1 элемент все равно. возможно пустой
    var items = dateTimeStr.split("-");
    if (items.length !== 2)
        return null;
    var dateStr = items[0].trim();
    return dateStr.length > 0 ? dateStr : null;
}
function filter(items, options) {
    var res = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        res[i] = false;
        if (options.From != "all" && item.From != options.From)
            continue;
        if (options.To != "all" && item.To != options.To)
            continue;
        if (options.Date != "all" && item.Date != options.Date)
            continue;
        if (item.Subj.match(new RegExp(options.SubjRx, "i")) == null)
            continue;
        res[i] = true;
    }
    return res;
}
function makeKeyValCount(items, keySelector, valueSelector) {
    var res = {};
    for (var i = 0; i < items.length; i++) {
        var key = keySelector(items[i]);
        var val = valueSelector ? valueSelector(items[i]) : key;
        if (res[key] != null)
            res[key].Count++;
        else
            res[key] = { Name: key, Value: val, Count: 1 };
    }
    var resArray = [];
    for (var key in res)
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
function getRealm() {
    // https://*virtonomic*.*/*/main/globalreport/marketing/by_trade_at_cities/*
    // https://*virtonomic*.*/*/window/globalreport/marketing/by_trade_at_cities/*
    var rx = new RegExp(/https:\/\/virtonomic[A-Za-z]+\.[a-zA-Z]+\/([a-zA-Z]+)\/.+/ig);
    var m = rx.exec(document.location.href);
    if (m == null)
        return null;
    return m[1];
}
$(document).ready(function () { return run(); });
//# sourceMappingURL=mailbox.user.js.map