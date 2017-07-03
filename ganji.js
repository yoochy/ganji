var http = require("http"),
    url = require("url"),
    superagent = require("superagent"),
    cheerio = require("cheerio"),
    async = require("async"),
    eventproxy = require('eventproxy');
var ep = new eventproxy(),
    urlsArray = [],	//存放爬取网址
    pageUrls = [],	//存放收集文章页面网站
    pageNum = 1,	//要爬取文章的页数
    catchData = [],//存取页面数据;
    endDate = false;	//结束时间
const fs = require('fs');

for(var i=1 ; i<= pageNum ; i++){
    pageUrls.push('http://hz.ganji.com/fang1/o'+i);
}
// 主start程序
function start(){
    function onRequest(req, res){
        // 轮询 所有文章列表页
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});// 内容类型: text/plain
        // 不然中文输出乱码
        pageUrls.forEach(function(pageUrl){
            superagent.get(pageUrl)
                .end(function(err,pres){
                    // pres.text 里面存储着请求返回的 html 内容，将它传给 cheerio.load 之后
                    // 就可以得到一个实现了 jquery 接口的变量，我们习惯性地将它命名为 `$`
                    // 剩下就都是利用$ 使用 jquery 的语法了
                    var $ = cheerio.load(pres.text);
                    // console.log($);
                    var curPageUrls = $('.js-title');
                    for(var i = 0 ; i < curPageUrls.length ; i++){
                        var articleUrl = curPageUrls.eq(i).attr('href');
                        urlsArray.push(articleUrl);
                        // 相当于一个计数器
                        ep.emit('GanjiHtml', articleUrl);
                    }
                });
        });
        ep.after('GanjiHtml', pageUrls.length*20 ,function(articleUrls){
            // 当所有 'GanjiHtml' 事件完成后的回调触发下面事件
            // 控制并发数
            var curCount = 0;
            var reptileMove = function(url,callback){
                //延迟毫秒数
                var delay = parseInt((Math.random() * 30000000) % 1000, 10);
                curCount++;
                console.log('现在的并发数是', curCount, '，正在抓取的是', url, '，耗时' + delay + '毫秒');
                var newurl='http://hz.ganji.com'+url;
                // res.write('<h1>采集到的数据是:'+newurl+'<br></h1>');
                superagent.get(newurl)
                    .end(function(err,sres){
                        if (err) {
                            console.log(err);
                            return;
                        }//sres.text 里面存储着请求返回的 html 内容
                        var $ = cheerio.load(sres.text);
                        //收集数据
                        personInfo(newurl);
                    });
                // res.write('<h2>房产数据是:'+catchData+'<br></h2>');
                setTimeout(function() {
                    curCount--;
                    callback(null,url +'Call back content');
                }, delay);
            };
            // 使用async控制异步抓取
            // mapLimit(arr, limit, iterator, [callback])
            // 异步回调
            async.mapLimit(articleUrls,1 ,function (url, callback) {
                reptileMove(url, callback);
            }, function (err,result) {
                // 4000 个 URL 访问完成的回调函数
                endDate = new Date();
                console.log(catchData);
                var len = catchData.length;
                for(var i=0 ; i<len ; i++){
                    var eachtitle = catchData[i].title;
                    var eachprice = catchData[i].price;

                    res.write('房屋标题--'+eachtitle +'-------房屋价格-----'+eachprice+'<br/>');
                }
            });
        });
    }
    http.createServer(onRequest).listen(5253);
}

function personInfo(url){
    var infoArray = {};
    superagent.get(url)
        .end(function(err,ares){
            if (err) {
                console.log(err);
                return;
            }
            var $ = cheerio.load(ares.text);
            infoArray.title = $('.card-title>i').text();
            infoArray.price = $('.price>span.num').text();
            var information=infoArray;
            var informations=JSON.stringify(infoArray);
            console.log('房产信息:'+informations);
            catchData.push(information);//吧information数据保存在catchData中
            if (informations) {
                informations = '  ' +informations + '\r\n';
                fs.appendFile('./data/' + '2.txt', informations, 'utf-8', function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        });
}
exports.start= start;