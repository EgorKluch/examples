/**
 * @date: 29.01.14
 *
 * Код взят со страницы: http://nodejs.org/api/domain.html#domain_additions_to_error_objects
 * Я удалил все комментарии из кода, и добавил несколько комментариев от себя.
 *
 * Что бы повторить баг, запустите дважды http://localhost:1337/error
 * Второй запрос упадет с ошибкой "Not running"
 */


var cluster = require('cluster');
var PORT = +process.env.PORT || 1337;

if (cluster.isMaster) {
  cluster.fork();
  cluster.fork();

  cluster.on('disconnect', function(worker) {
    console.error('disconnect!');
    cluster.fork();
  });

} else {
  var domain = require('domain');

  var server = require('http').createServer(function(req, res) {
    var d = domain.create();
    d.on('error', function(er) {
      console.error('error', er.stack);

      try {
        var killtimer = setTimeout(function() {
          // Опасно! Keep-alive соединения могут быть еще открыты!
          process.exit(1);
        }, 30000);
        killtimer.unref();

        /*
         Закрываем сервер для новых запросов
         По умолчанию, браузеры устанавливают keep-alive соеденения.
         По этой причине, запросы с уже открытого постоянного соединения
         будут проходить! В случае повторной ошибки, опять попадаем сюда.
         При повторном вызове метода генерируется навая ошибка - "Not running".
         */
        server.close();

        cluster.worker.disconnect();

        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain');
        res.end('Oops, there was a problem!\n');
      } catch (er2) {
        console.error('Error sending 500!', er2.stack);
      }
    });

    d.add(req);
    d.add(res);

    d.run(function() {
      handleRequest(req, res);
    });
  });
  server.listen(PORT);
}

function handleRequest(req, res) {
  switch(req.url) {
    case '/error':
      setTimeout(function() {
        flerb.bark();
      });
      break;
    default:
      res.end('ok');
  }
}
