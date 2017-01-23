// ==UserScript==
// @name           Virtonomica: mailbox
// @namespace      https://github.com/ra81/mailbox
// @version 	   1.09
// @description    Фильтрация писем в почтовом ящике
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/system
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/inbox
// @include        https://*virtonomic*.*/*/main/user/privat/persondata/message/outbox
// @require        https://code.jquery.com/jquery-1.11.1.min.js
// ==/UserScript== 
// 
// Набор вспомогательных функций для использования в других проектах. Универсальные
//   /// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
/**
 * Проверяет наличие в словаре ключей. Шорт алиас для удобства.
 * Если словарь не задать, вывалит исключение
 * @param dict проверяемый словарь
 */
function isEmpty(dict) {
    return Object.keys(dict).length === 0; // исключение на null
}
/**
 * Конвертит словарь в простую текстовую строку вида "key:val, key1:val1"
 * значения в строку конвертятся штатным toString()
 * Создана чисто потому что в словарь нельзя засунуть методы.
 * @param dict
 */
function dict2String(dict) {
    if (isEmpty(dict))
        return "";
    var newItems = [];
    for (var key in dict)
        newItems.push(key + ":" + dict[key].toString());
    return newItems.join(", ");
}
/**
 * Проверяет что элемент есть в массиве.
 * @param item
 * @param arr массив НЕ null
 */
function isOneOf(item, arr) {
    return arr.indexOf(item) >= 0;
}
// PARSE -------------------------------------------
/**
 * удаляет из строки все денежные и специальные символы типо процента и пробелы между цифрами
 * @param str
 */
function cleanStr(str) {
    return str.replace(/[\s\$\%\©]/g, "");
}
/**
 * Выдергивает реалм из текущего href ссылки если это возможно.
 */
function getRealm() {
    // https://*virtonomic*.*/*/main/globalreport/marketing/by_trade_at_cities/*
    // https://*virtonomic*.*/*/window/globalreport/marketing/by_trade_at_cities/*
    var rx = new RegExp(/https:\/\/virtonomic[A-Za-z]+\.[a-zA-Z]+\/([a-zA-Z]+)\/.+/ig);
    var m = rx.exec(document.location.href);
    if (m == null)
        return null;
    return m[1];
}
/**
 * Парсит id компании со страницы
 */
function getCompanyId() {
    var str = matchedOrError($("a.dashboard").attr("href"), /\d+/);
    return numberfyOrError(str);
}
/**
 * Оцифровывает строку. Возвращает всегда либо число или Number.POSITIVE_INFINITY либо -1 если отпарсить не вышло.
 * @param variable любая строка.
 */
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
        var n = parseFloat(cleanStr(String(str)));
        return isNaN(n) ? -1 : n;
    }
}
/**
 * Пробуем оцифровать данные но если они выходят как Number.POSITIVE_INFINITY или <= minVal, валит ошибку.
   смысл в быстром вываливании ошибки если парсинг текста должен дать число
 * @param value строка являющая собой число больше minVal
 * @param minVal ограничение снизу. Число.
 * @param infinity разрешена ли бесконечность
 */
function numberfyOrError(str, minVal, infinity) {
    if (minVal === void 0) { minVal = 0; }
    if (infinity === void 0) { infinity = false; }
    var n = numberfy(str);
    if (!infinity && (n === Number.POSITIVE_INFINITY || n === Number.NEGATIVE_INFINITY))
        throw new RangeError("Получили бесконечность, что запрещено.");
    if (n <= minVal)
        throw new RangeError("Число должно быть > " + minVal);
    return n;
}
/**
 * Ищет паттерн в строке. Предполагая что паттерн там обязательно есть 1 раз. Если
 * нет или случился больше раз, валим ошибку
 * @param str строка в которой ищем
 * @param rx паттерн который ищем
 */
function matchedOrError(str, rx, errMsg) {
    var m = str.match(rx);
    if (m == null)
        throw new Error(errMsg || "\u041F\u0430\u0442\u0442\u0435\u0440\u043D " + rx + " \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 " + str);
    if (m.length > 1)
        throw new Error(errMsg || "\u041F\u0430\u0442\u0442\u0435\u0440\u043D " + rx + " \u043D\u0430\u0439\u0434\u0435\u043D \u0432 " + str + " " + m.length + " \u0440\u0430\u0437 \u0432\u043C\u0435\u0441\u0442\u043E \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u043E\u0433\u043E 1");
    return m[0];
}
/**
 * Пробуем прогнать регулярное выражение на строку, если не прошло, то вывалит ошибку.
 * иначе вернет массив. 0 элемент это найденная подстрока, остальные это найденные группы ()
 * @param str
 * @param rx
 * @param errMsg
 */
function execOrError(str, rx, errMsg) {
    var m = rx.exec(str);
    if (m == null)
        throw new Error(errMsg || "\u041F\u0430\u0442\u0442\u0435\u0440\u043D " + rx + " \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 " + str);
    return m;
}
/**
 * из строки пробует извлечь все вещественные числа. Рекомендуется применять ТОЛЬКО для извлечения из текстовых строк.
 * для простого парсинга числа пойдет numberfy
 * Если их нет вернет null
 * @param str
 */
function extractFloatPositive(str) {
    var m = cleanStr(str).match(/\d+\.\d+/ig);
    if (m == null)
        return null;
    var n = m.map(function (i, e) { return numberfyOrError($(e).text(), -1); });
    return n;
}
/**
 * По текстовой строке возвращает номер месяца начиная с 0 для января. Либо null
 * @param str очищенная от пробелов и лишних символов строка
 */
function monthFromStr(str) {
    var mnth = ["янв", "февр", "мар", "апр", "май", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"];
    for (var i = 0; i < mnth.length; i++) {
        if (str.indexOf(mnth[i]) === 0)
            return i;
    }
    return null;
}
/**
 * По типовой игровой строке даты вида 10 января 55 г., 3 февраля 2017 - 22.10.12
 * выдергивает именно дату и возвращает в виде объекта даты
 * @param str
 */
function extractDate(str) {
    var dateRx = /^(\d{1,2})\s+([а-я]+)\s+(\d{1,4})/i;
    var m = dateRx.exec(str);
    if (m == null)
        return null;
    var d = parseInt(m[1]);
    var mon = monthFromStr(m[2]);
    if (mon == null)
        return null;
    var y = parseInt(m[3]);
    return new Date(y, mon, d);
}
/**
 * из даты формирует короткую строку типа 01.12.2017
 * @param date
 */
function dateToShort(date) {
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var yyyy = date.getFullYear();
    var dStr = d < 10 ? "0" + d : d.toString();
    var mStr = m < 10 ? "0" + m : m.toString();
    return dStr + "." + mStr + "." + yyyy;
}
/**
 * из строки вида 01.12.2017 формирует дату
 * @param str
 */
function dateFromShort(str) {
    var items = str.split(".");
    var d = parseInt(items[0]);
    if (d <= 0)
        throw new Error("дата неправильная.");
    var m = parseInt(items[1]) - 1;
    if (m < 0)
        throw new Error("месяц неправильная.");
    var y = parseInt(items[2]);
    if (y < 0)
        throw new Error("год неправильная.");
    return new Date(y, m, d);
}
var urlUnitMainRx = /\/\w+\/main\/unit\/view\/\d+\/?$/i;
var urlTradeHallRx = /\/[a-z]+\/main\/unit\/view\/\d+\/trading_hall\/?/i;
var urlVisitorsHistoryRx = /\/[a-z]+\/main\/unit\/view\/\d+\/visitors_history\/?/i;
function isMyUnitList() {
    // для ссылки обязательно завершающий unit_list мы так решили
    var rx = /\/\w+\/main\/company\/view\/\d+\/unit_list\/?$/ig;
    if (rx.test(document.location.pathname) === false)
        return false;
    // помимо ссылки мы можем находиться на чужой странице юнитов
    if ($("#mainContent > table.unit-top").length === 0
        || $("#mainContent > table.unit-list-2014").length === 0)
        return false;
    return true;
}
function isUnitMain() {
    return urlUnitMainRx.test(document.location.pathname);
}
function isShop() {
    var $a = $("ul.tabu a[href$=trading_hall]");
    return $a.length === 1;
}
function isVisitorsHistory() {
    return urlVisitorsHistoryRx.test(document.location.pathname);
}
// JQUERY ----------------------------------------
/**
 * Возвращает ближайшего родителя по имени Тэга
   работает как и closest. Если родитель не найден то не возвращает ничего для данного элемента
    то есть есть шанс что было 10 а родителей нашли 4 и их вернули.
 * @param items набор элементов JQuery
 * @param tagname имя тэга. tr, td, span и так далее
 */
function closestByTagName(items, tagname) {
    var tag = tagname.toUpperCase();
    var found = [];
    for (var i = 0; i < items.length; i++) {
        var node = items[i];
        while ((node = node.parentNode) && node.nodeName != tag) { }
        ;
        if (node)
            found.push(node);
    }
    return $(found);
}
/**
 * Для заданного элемента, находит все непосредственно расположенные в нем текстовые ноды и возвращает их текст.
   очень удобен для извлечения непосредственного текста из тэга БЕЗ текста дочерних нодов
 * @param item 1 объект типа JQuery
 */
function getOnlyText(item) {
    // просто children() не отдает текстовые ноды.
    var $childrenNodes = item.contents();
    var res = [];
    for (var i = 0; i < $childrenNodes.length; i++) {
        var el = $childrenNodes.get(i);
        if (el.nodeType === 3)
            res.push($(el).text()); // так как в разных браузерах текст запрашивается по разному, 
    }
    return res;
}
/**
 * Пробует найти ровно 1 элемент для заданного селектора. если не нашло или нашло больше валит ошибку
 * @param $item
 * @param selector
 */
function oneOrError($item, selector) {
    var $one = $item.find(selector);
    if ($one.length != 1)
        throw new Error("\u041D\u0430\u0439\u0434\u0435\u043D\u043E " + $one.length + " \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0432\u043C\u0435\u0441\u0442\u043E 1 \u0434\u043B\u044F \u0441\u0435\u043B\u0435\u043A\u0442\u043E\u0440\u0430 " + selector);
    return $one;
}
// COMMON ----------------------------------------
var $xioDebug = false;
function logDebug(msg) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    if (!$xioDebug)
        return;
    if (args.length === 0)
        console.log(msg);
    else
        console.log(msg, args);
}
/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
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
    var $rows = closestByTagName($mailTable.find("input[name='message[]']"), "tr");
    var mails = parseRows($rows);
    // создаем панельку, и шоутайм.
    var $panel = buildFilterPanel(mails);
    $("form").before($panel);
    $panel.show();
    $panel.change();
    // изменим поведение штатной галочки выделения
    // chbx.attr("onclick", null).off("click")
    var $controlChbx = $("#messageListControlCheckbox");
    $controlChbx.attr("onclick", "").off("click");
    $controlChbx.on("change", function (event) {
        var checked = $controlChbx.prop("checked");
        // если unchecked то снимем галки ВООБЩЕ со всех
        // иначе выставим тока на видимые строки
        if (!checked)
            $rows.each(function (i, e) { return $(e).find("input[name='message[]']").prop("checked", false); });
        else
            $rows.filter(":visible").each(function (i, e) { return $(e).find("input[name='message[]']").prop("checked", true); });
        return false;
    });
    // Функции
    //
    // делает фильтрацию, возвращая массив фильтрованных строк
    function doFilter($panel) {
        var op = getFilterOptions($panel);
        var filterMask = buildMask(mails, op);
        for (var i = 0; i < mails.length; i++) {
            var mail = mails[i];
            if (filterMask[i])
                mail.$row.show();
            else
                mail.$row.hide();
        }
        // сохраним опции
        storeOpions(op);
        return filter(mails, filterMask);
    }
    function buildFilterPanel(mails) {
        function buildOptions(items, first) {
            if (first === void 0) { first = ["all"]; }
            var optionsHtml = '';
            // некоторые общие опции всегда существующие
            for (var i = 0; i < first.length; i++)
                optionsHtml += "<option value=\"" + first[i] + "\", label=\"" + first[i] + "\">" + first[i] + "</option>";
            // собственно элементы
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
        // фильтры
        //
        var fromFilter = $("<select id='fromFilter' class='option' style='min-width: 100px; max-width:160px;'>");
        var toFilter = $("<select id='toFilter' class='option' style='min-width: 100px; max-width:160px;'>");
        var dateFilter = $("<select id='dateFilter' class='option' style='min-width: 100px; max-width:160px;'>");
        var subjFilter = $('<input id="subjFilter" class="option" style="width:200px;"></input>').attr({ type: 'text', value: '' });
        var resetBtn = $('<input type=button id=reset value="*">').css("color", "red");
        var dymamicChbx = $("<input type='checkbox' id='chbxDynamic'>");
        // события на обновление списка в селекте. Внутрь передаются данные. Массив по которому делать опции
        fromFilter.on("filter:updateOps", function (event, data) {
            var froms = makeKeyValCount(data.items, function (el) { return el.From; });
            froms.sort(function (a, b) {
                if (a.Value.toLocaleLowerCase() > b.Value.toLocaleLowerCase())
                    return 1;
                if (a.Value.toLocaleLowerCase() < b.Value.toLocaleLowerCase())
                    return -1;
                return 0;
            });
            var val = $(this).val();
            $(this).children().remove().end().append(buildOptions(froms, ["all", "new"]));
            if (val != null)
                $(this).val(val);
        });
        toFilter.on("filter:updateOps", function (event, data) {
            var tos = makeKeyValCount(data.items, function (el) { return el.To; });
            tos.sort(function (a, b) {
                if (a.Value.toLocaleLowerCase() > b.Value.toLocaleLowerCase())
                    return 1;
                if (a.Value.toLocaleLowerCase() < b.Value.toLocaleLowerCase())
                    return -1;
                return 0;
            });
            var val = $(this).val();
            $(this).children().remove().end().append(buildOptions(tos));
            if (val != null)
                $(this).val(val);
        });
        dateFilter.on("filter:updateOps", function (event, data) {
            var dates = makeKeyValCount(data.items, function (el) { return el.Date.toLocaleDateString(); }, function (el) { return el.Date.toDateString(); });
            dates.sort(function (a, b) {
                if (new Date(a.Value) > new Date(b.Value))
                    return -1;
                if (new Date(a.Value) < new Date(b.Value))
                    return 1;
                return 0;
            });
            var val = $(this).val();
            $(this).children().remove().end().append(buildOptions(dates));
            if (val != null)
                $(this).val(val);
        });
        // вызовем события сразу чтобы забить значениями полным набором элементов.
        fromFilter.trigger("filter:updateOps", { items: mails });
        toFilter.trigger("filter:updateOps", { items: mails });
        dateFilter.trigger("filter:updateOps", { items: mails });
        // не фильтрую по классам чтобы потом просто вызывать change для панели не вникая в детали реализации
        $panel.on("change", function (event) {
            var el = $(event.target);
            var m = doFilter($panel);
            // когда мы поставили или убрали галку чекбокса, обязаны обновить селекты
            // НО если сняли, то обновить надо полным списком, а если поствили то фильтрованным.
            var mailsFiltered = dymamicChbx.prop("checked") ? m : mails;
            if (el.is(dymamicChbx) || dymamicChbx.prop("checked")) {
                var is = el.is(fromFilter);
                if (!is || (is && el.prop('selectedIndex') === 0))
                    fromFilter.trigger("filter:updateOps", { items: mailsFiltered });
                is = el.is(toFilter);
                if (!is || (is && el.prop('selectedIndex') === 0))
                    toFilter.trigger("filter:updateOps", { items: mailsFiltered });
                is = el.is(dateFilter);
                if (!is || (is && el.prop('selectedIndex') === 0))
                    dateFilter.trigger("filter:updateOps", { items: mailsFiltered });
            }
            return false;
        });
        $panel.on("dblclick", ".option", function (event) {
            var el = event.target;
            $(el).prop('selectedIndex', 0);
            $panel.change();
            return false;
        });
        // сброс фильтров
        resetBtn.click(function (event) {
            fromFilter.prop('selectedIndex', 0);
            toFilter.prop('selectedIndex', 0);
            dateFilter.prop('selectedIndex', 0);
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
            dymamicChbx.prop("checked", op.Dynamic);
        }
        // дополняем панель до конца элементами
        //
        $panel.append("<span> </span>").append(dymamicChbx);
        $panel.append("<span>From: </span>").append(fromFilter);
        $panel.append("<span> To: </span>").append(toFilter);
        $panel.append("<span> Date: </span>").append(dateFilter);
        $panel.append("<span> Subject: </span>").append(subjFilter);
        $panel.append("<span> </span>").append(resetBtn);
        // на выходе панель нужно куда то добавить и вызвать событие change. она сама обновит себя и список
        return $panel;
    }
}
function getFilterOptions($panel) {
    return {
        From: $panel.find("#fromFilter").val(),
        To: $panel.find("#toFilter").val(),
        DateStr: $panel.find("#dateFilter").val(),
        SubjRx: $panel.find("#subjFilter").val().toLowerCase(),
        Dynamic: $panel.find("#chbxDynamic").prop("checked"),
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
    var isUnread = $rows.map(function (i, e) { return $(e).find("a.new_message").length > 0; });
    if (from.length !== to.length || from.length !== subj.length)
        throw new Error("Ошибка парсинга списка писем.");
    for (var i = 0; i < $rows.length; i++) {
        var $r = $rows.eq(i);
        mails.push({
            $row: $r,
            From: from[i].length > 0 ? from[i] : "system",
            To: to[i].length > 0 ? to[i] : "system",
            Date: date[i] != null ? date[i] : new Date(),
            Subj: subj[i].length > 0 ? subj[i] : "no subject",
            IsUnread: isUnread[i]
        });
    }
    return mails;
}
function buildMask(items, options) {
    var res = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        res[i] = false;
        switch (options.From) {
            case "all":
                break;
            case "new":
                if (!item.IsUnread)
                    continue;
                break;
            default:
                if (item.From != options.From)
                    continue;
        }
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
function filter(items, mask) {
    var res = [];
    for (var i = 0; i < items.length; i++)
        if (mask[i])
            res.push(items[i]);
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
function getBox() {
    // /fast/main/user/privat/persondata/message/system
    var items = document.location.pathname.split("/");
    return items[items.length - 1];
}
$(document).ready(function () { return run(); });
//# sourceMappingURL=mailbox.user.js.map