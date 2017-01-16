// ==UserScript==
// @name           Virtonomica: mailbox
// @namespace      https://github.com/ra81/mailbox
// @version 	   1.04
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
    $panel.change();
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
        // сохраним опции
        storeOpions(op);
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
        var fromFilter = $("<select id='fromFilter' class='option' style='max-width:200px;'>");
        var froms = makeKeyValCount(mails, function (el) { return el.From; });
        fromFilter.append(buildOptions(froms));
        // фильтр по To
        var toFilter = $("<select id='toFilter' class='option' style='max-width:200px;'>");
        var tos = makeKeyValCount(mails, function (el) { return el.To; });
        toFilter.append(buildOptions(tos));
        // фильтр по Date. даты сортируем по убыванию для удобства
        var dateFilter = $("<select id='dateFilter' class='option' style='max-width:200px;'>");
        var dates = makeKeyValCount(mails, function (el) { return el.Date.toLocaleDateString(); }, function (el) { return el.Date.toDateString(); });
        dates.sort(function (a, b) {
            if (new Date(a.Value) > new Date(b.Value))
                return -1;
            if (new Date(a.Value) < new Date(b.Value))
                return 1;
            return 0;
        });
        dateFilter.append(buildOptions(dates));
        // текстовый фильтр
        var subjFilter = $('<input id="subjFilter" class="option" style="max- width:400px;"></input>').attr({ type: 'text', value: '' });
        // запрос сразу всех данных по эффективности
        var resetButton = $('<input type=button id=reset value="*">').css("color", "red");
        // события смены фильтров
        //
        // не фильтрую по классам чтобы потом просто вызывать change для панели не вникая в детали реализации
        $panel.on("change", function (event) { return doFilter($panel); });
        resetButton.click(function (event) {
            fromFilter.val("all");
            toFilter.val("all");
            dateFilter.val("all");
            subjFilter.val("");
            // когда из кода меняешь то события не работают
            $panel.change();
        });
        // загрузим опции со стораджа и выставим каждый фильтр в это значение
        var op = loadOpions();
        if (op != null) {
            fromFilter.val(op.From);
            toFilter.val(op.To);
            dateFilter.val(op.DateStr);
            subjFilter.val(op.SubjRx);
        }
        // дополняем панель до конца элементами
        //
        $panel.append("<span>From: </span>").append(fromFilter);
        $panel.append("<span> To: </span>").append(toFilter);
        $panel.append("<span> Date: </span>").append(dateFilter);
        $panel.append("<span> Subject: </span>").append(subjFilter);
        $panel.append("<span> </span>").append(resetButton);
        return $panel;
    }
}
function getFilterOptions($panel) {
    return {
        From: $panel.find("#fromFilter").val(),
        To: $panel.find("#toFilter").val(),
        DateStr: $panel.find("#dateFilter").val(),
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
            Date: date[i] != null ? date[i] : new Date(),
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
    if (dateStr.length === 0)
        return null;
    items = dateStr.split(" ");
    if (items.length !== 3)
        return null;
    var d = numberfy(items[0]);
    var m = month(items[1]);
    var y = numberfy(items[2]);
    if (d < 1 || m == null || y < 1)
        return null;
    return new Date(y, m, d);
    function month(str) {
        var mnth = ["янв", "февр", "мар", "апр", "май", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"];
        for (var i = 0; i < mnth.length; i++) {
            if (str.indexOf(mnth[i]) === 0)
                return i;
        }
        return null;
    }
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
        if (options.DateStr != "all" && item.Date.getTime() != (new Date(options.DateStr)).getTime())
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
function storeOpions(options) {
    var key = "mail_" + getBox(); // mail_system, mail_inbox
    localStorage.setItem(key, JSON.stringify(options));
}
function loadOpions() {
    var key = "mail_" + getBox(); // mail_system, mail_inbox
    var ops = localStorage.getItem(key); // значение или null
    if (ops == null)
        return null;
    return JSON.parse(ops);
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
function getBox() {
    // /fast/main/user/privat/persondata/message/system
    var items = document.location.pathname.split("/");
    return items[items.length - 1];
}
function numberfy(str) {
    // возвращает либо число полученно из строки, либо БЕСКОНЕЧНОСТЬ, либо -1 если не получилось преобразовать.
    if (String(str) === 'Не огр.' ||
        String(str) === 'Unlim.' ||
        String(str) === 'Не обм.' ||
        String(str) === 'N’est pas limité' ||
        String(str) === 'No limitado' ||
        String(str) === '无限' ||
        String(str) === 'Nicht beschr.') {
        return Number.POSITIVE_INFINITY;
    }
    else {
        // если str будет undef null или что то страшное, то String() превратит в строку после чего парсинг даст NaN
        // не будет эксепшнов
        var n = parseFloat(String(str).replace(/[\s\$\%\©]/g, ""));
        return isNaN(n) ? -1 : n;
    }
}
$(document).ready(function () { return run(); });
//# sourceMappingURL=mailbox.user.js.map