
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
    IsUnread: boolean;
}
interface IFilterOptions {
    From: string;
    To: string;
    DateStr: string;
    SubjRx: string;
    Dynamic: boolean;
}

function run() {
    let $ = jQuery;
    let realm = getRealm();
    console.log("box");
    // закончить если мы не на той странице
    //let pathRx = new RegExp(/\/([a-zA-Z]+)\/main\/company\/view\/\d+(?:\/unit_list\/?)?$/ig);
    //if (pathRx.test(document.location.pathname) === false) {
    //    console.log("management: not on unit list page.");
    //    return;
    //}

    // работа
    let $mailTable = $("table.grid");
    let $rows = closestByTagName($mailTable.find("input[name='message[]']"), "tr");
    let mails = parseRows($rows);

    // создаем панельку, и шоутайм.
    let $panel = buildFilterPanel(mails);
    $("form").before($panel);
    $panel.show();
    $panel.change();

    // изменим поведение штатной галочки выделения
    // chbx.attr("onclick", null).off("click")
    let $controlChbx = $("#messageListControlCheckbox");
    $controlChbx.attr("onclick", "").off("click");
    $controlChbx.on("change", (event) => {
        let checked = $controlChbx.prop("checked") as boolean;

        // если unchecked то снимем галки ВООБЩЕ со всех
        // иначе выставим тока на видимые строки
        if (!checked)
            $rows.each((i, e) => $(e).find("input[name='message[]']").prop("checked", false));
        else
            $rows.filter(":visible").each((i, e) => $(e).find("input[name='message[]']").prop("checked", true));

        return false;
    });

    // Функции
    //
    // делает фильтрацию, возвращая массив фильтрованных строк
    function doFilter($panel: JQuery) {

        let op = getFilterOptions($panel);
        let filterMask = buildMask(mails, op);

        for (let i = 0; i < mails.length; i++) {
            let mail = mails[i];

            if (filterMask[i])
                mail.$row.show();
            else
                mail.$row.hide();
        }

        // сохраним опции
        storeOpions(op);

        return filter(mails, filterMask);
    }

    function buildFilterPanel(mails: IMail[]) {

        function buildOptions (items: TNameValueCount[], first: string[] = ["all"]) {
            let optionsHtml = '';

            // некоторые общие опции всегда существующие
            for (let i = 0; i < first.length; i++)
                optionsHtml += `<option value="${first[i]}", label="${first[i]}">${first[i]}</option>`;

            // собственно элементы
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

        // фильтры
        //
        let fromFilter = $("<select id='fromFilter' class='option' style='min-width: 100px; max-width:160px;'>");
        let toFilter = $("<select id='toFilter' class='option' style='min-width: 100px; max-width:160px;'>");
        let dateFilter = $("<select id='dateFilter' class='option' style='min-width: 100px; max-width:160px;'>");
        let subjFilter = $('<input id="subjFilter" class="option" style="width:200px;"></input>').attr({ type: 'text', value: '' });
        let resetBtn = $('<input type=button id=reset value="*">').css("color", "red");
        let dymamicChbx = $("<input type='checkbox' id='chbxDynamic'>");

        // события смены фильтров
        //
        type TData = { items: IMail[] };

        // события на обновление списка в селекте. Внутрь передаются данные. Массив по которому делать опции
        fromFilter.on("filter:updateOps", function (this: Element, event: JQueryEventObject, data: TData) {
            let froms = makeKeyValCount<IMail>(data.items, (el) => el.From);
            froms.sort((a, b) => {
                if (a.Value.toLocaleLowerCase() > b.Value.toLocaleLowerCase())
                    return 1;

                if (a.Value.toLocaleLowerCase() < b.Value.toLocaleLowerCase())
                    return -1;

                return 0;
            });

            let val = $(this).val();
            $(this).children().remove().end().append(buildOptions(froms, ["all", "new"]));

            if (val != null)
                $(this).val(val);
        });
        toFilter.on("filter:updateOps", function (this: Element, event: JQueryEventObject, data: TData) {
            let tos = makeKeyValCount<IMail>(data.items, (el) => el.To);
            tos.sort((a, b) => {
                if (a.Value.toLocaleLowerCase() > b.Value.toLocaleLowerCase())
                    return 1;

                if (a.Value.toLocaleLowerCase() < b.Value.toLocaleLowerCase())
                    return -1;

                return 0;
            });

            let val = $(this).val();
            $(this).children().remove().end().append(buildOptions(tos));

            if (val != null)
                $(this).val(val);
        });
        dateFilter.on("filter:updateOps", function (this: Element, event: JQueryEventObject, data: TData) {
            let dates = makeKeyValCount<IMail>(data.items, (el) => el.Date.toLocaleDateString(), (el) => el.Date.toDateString());
            dates.sort((a, b) => {
                if (new Date(a.Value) > new Date(b.Value))
                    return -1;

                if (new Date(a.Value) < new Date(b.Value))
                    return 1;

                return 0;
            });
            let val = $(this).val();
            $(this).children().remove().end().append(buildOptions(dates));

            if (val != null)
                $(this).val(val);
        });
        // вызовем события сразу чтобы забить значениями полным набором элементов.
        fromFilter.trigger("filter:updateOps", { items: mails });
        toFilter.trigger("filter:updateOps", { items: mails });
        dateFilter.trigger("filter:updateOps", { items: mails });

        // не фильтрую по классам чтобы потом просто вызывать change для панели не вникая в детали реализации
        $panel.on("change", function (this:Element, event: JQueryEventObject) {
            let el = $(event.target);
            let m = doFilter($panel);

            // когда мы поставили или убрали галку чекбокса, обязаны обновить селекты
            // НО если сняли, то обновить надо полным списком, а если поствили то фильтрованным.
            let mailsFiltered = dymamicChbx.prop("checked") ? m : mails;
            if (el.is(dymamicChbx) || dymamicChbx.prop("checked")) {
                let is = el.is(fromFilter);
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
        $panel.on("dblclick", ".option", function (this: Element, event: JQueryEventObject) {
            let el = event.target;
            $(el).prop('selectedIndex', 0);

            $panel.change();
            return false;
        });
        // сброс фильтров
        resetBtn.click((event) => {
            fromFilter.prop('selectedIndex', 0);
            toFilter.prop('selectedIndex', 0);
            dateFilter.prop('selectedIndex', 0);
            subjFilter.val("");

            // когда из кода меняешь то события не работают
            $panel.change();
        });

        // загрузим опции со стораджа и выставим каждый фильтр в это значение
        let op = loadOpions();
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

function getFilterOptions($panel: JQuery): IFilterOptions {
    return {
        From: $panel.find("#fromFilter").val(),
        To: $panel.find("#toFilter").val(),
        DateStr: $panel.find("#dateFilter").val(),
        SubjRx: $panel.find("#subjFilter").val().toLowerCase(),
        Dynamic: $panel.find("#chbxDynamic").prop("checked"),
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
    
    let date = $rows.find("td:nth-child(4)").map(fDate) as any as (Date | null)[];
    let subj = $rows.find("td:nth-child(5)").map((i, e) => $(e).text().trim()) as any as string[];
    let isUnread = $rows.map((i, e) => $(e).find("a.new_message").length > 0) as any as boolean[];

    if (from.length !== to.length || from.length !== subj.length)
        throw new Error("Ошибка парсинга списка писем.");

    for (let i = 0; i < $rows.length; i++) {
        let $r = $rows.eq(i);

        mails.push({
            $row: $r,
            From: from[i].length > 0 ? from[i] : "system",
            To: to[i].length > 0 ? to[i] : "system",
            Date: date[i] != null ? date[i] as Date : new Date(),
            Subj: subj[i].length > 0 ? subj[i] : "no subject",
            IsUnread: isUnread[i]
        });
    }

    return mails;
}

function buildMask(items: IMail[], options: IFilterOptions) {

    let res: boolean[] = [];
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        res[i] = false;

        switch (options.From) {
            case "all":
                break;

            case "new":
                if (!item.IsUnread) continue;
                break;

            default:
                if (item.From != options.From) continue;
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

function filter(items: IMail[], mask: boolean[]): IMail[] {
    let res: IMail[] = [];
    for (let i = 0; i < items.length; i++)
        if (mask[i])
            res.push(items[i]);

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

function storeOpions(options: IFilterOptions) {
    let key = "mail_" + getBox();  // mail_system, mail_inbox
    localStorage.setItem(key, JSON.stringify(options));
}

function loadOpions(): IFilterOptions | null {
    let key = "mail_" + getBox();  // mail_system, mail_inbox
    let ops = localStorage.getItem(key);  // значение или null
    if (ops == null)
        return null;

    return JSON.parse(ops) as IFilterOptions;
}

function getBox(): string {
    // /fast/main/user/privat/persondata/message/system
    let items = document.location.pathname.split("/");
    return items[items.length-1];
}


interface IDictionary<T> {
    [key: string]: T;
}
interface IDictionaryN<T> {
    [key: number]: T;
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
function closestByTagName(items: JQuery, tagname: string): JQuery {
    let tag = tagname.toUpperCase();

    let found: Node[] = [];
    for (let i = 0; i < items.length; i++) {
        let node: Node = items[i];
        while ((node = node.parentNode) && node.nodeName != tag) { };

        if (node)
            found.push(node);
    }

    return $(found);
}
function monthFromStr(str: string) {
    let mnth = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
    for (let i = 0; i < mnth.length; i++) {
        if (str.indexOf(mnth[i]) === 0)
            return i;
    }

    return null;
}
function extractDate(str: string): Date | null {
    let dateRx = /^(\d{1,2})\s+([а-я]+)\s+(\d{1,4})/i;
    let m = dateRx.exec(str);
    if (m == null)
        return null;

    let d = parseInt(m[1]);
    let mon = monthFromStr(m[2]);
    if (mon == null)
        return null;

    let y = parseInt(m[3]);

    return new Date(y, mon, d);
}

$(document).ready(() => run());
