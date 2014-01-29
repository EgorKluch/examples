/**
 * @date: 29.01.14
 *
 * Код взят со страницы: http://nodejs.org/api/domain.html#domain_additions_to_error_objects
 * Я выложил fix бага, прокомментировав его.
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
        /*
         Задаем время таймера значительно больше,
         чем время Keep-alive соединения (см. ниже)

         Я не знаю, бывают ли ошибки, которые подвешивают соединения намертво.
         Этот код как раз обрабатывает такой вариант подвешенного соединения.
         */
        var killtimer = setTimeout(function() {
          // Все соединения давно должны быть закрыты.
          // Если процесс еще живой - что-то не так, закрываем
          process.exit(1);
        }, 15 * 60 * 1000);
        killtimer.unref();

        /*
         Закрываем сервер для новых запросов
         По умолчанию, браузеры устанавливают keep-alive соеденения.
         По этой причине, запросы с уже открытого постоянного соединения
         будут проходить! В случае повторной ошибки, опять попадаем сюда.
         Поэтому, необходимо проверить - вызывалось ли уже server.close()
         */
        if (server._handle) {
          // Сервер еще открыт для новых запросов
          // Закрываем его
          server.close(function () {
            // Все, все соединения закрыты
            // Убиваем процесс
            process.exit(1);
          });
          // worker.dissconnect так нельзя вызывать больше одного раза
          cluster.worker.disconnect();
        }

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

  server.on('connection', function(socket) {
    // Задаем время жизни Keep-alive соединения на 5 минут
    socket.setTimeout(5 * 60 * 1000);
  });
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
