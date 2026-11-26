/* КОНФИГ */
const preloaderWaitingTime = 1200;
const requestTimeout = 6000;
const videoTimeout = 8000;
const cardsOnPage = 5;
const BASE_URL = 'https://v-content.practicum-team.ru';
const endpoint = `${BASE_URL}/api/videos?pagination[pageSize]=${cardsOnPage}&`;

/* ЭЛЕМЕНТЫ СТРАНИЦЫ */
const cardsList = document.querySelector('.content__list');
const cardsContainer = document.querySelector('.content__list-container');
const videoContainer = document.querySelector('.result__video-container');
const videoElement = document.querySelector('.result__video');
const form = document.querySelector('form');

/* ТЕМПЛЕЙТЫ */
const cardTmp = document.querySelector('.cards-list-item-template');
const preloaderTmp = document.querySelector('.preloader-template');
const videoNotFoundTmp = document.querySelector('.error-template');
const moreButtonTmp = document.querySelector('.more-button-template');

/* МЕХАНИКА */

// Нужен для работы с переключателями
let cardsOnPageState = [];
let currentSearch;
let currentVideoLoad;

// осуществляется поиск ✅
form.onsubmit = (e) => {
  e.preventDefault();
  const { city, timeArray } = serializeFormData(form);
  startSearch(generateFilterRequest(endpoint, city, timeArray));
};

startSearch(endpoint);

function startSearch(requestUrl) {
  currentSearch?.abort();
  currentVideoLoad?.abort();
  currentSearch = new AbortController();
  cardsOnPageState = [];
  cardsList.replaceChildren();
  cardsContainer.querySelector('.more-button')?.remove();
  videoContainer.querySelector('.error')?.remove();
  videoElement.removeAttribute('src');
  videoElement.load();
  mainMechanics(requestUrl, currentSearch.signal);
}

/* ФУНКЦИЯ, КОТОРАЯ ВСЕ ГЕНЕРИТ */

async function mainMechanics(requestUrl, signal) {
  const videoPreloader = showPreloader(preloaderTmp, videoContainer);
  const listPreloader = showPreloader(preloaderTmp, cardsContainer);
  try {
    const data = await fetchVideos(requestUrl, signal);
    if (signal.aborted) return;
    if (!data.results.length) {
      showError(videoContainer, videoNotFoundTmp, 'Нет подходящих видео =(');
      return;
    }

    cardsOnPageState = data.results;
    appendCards({
      baseUrl: BASE_URL,
      dataArray: data.results,
      cardTmp,
      container: cardsList,
    });

    document
      .querySelectorAll('.content__card-link')[0]
      .classList.add('content__card-link_current');

    // Добавляем класс для стилизации скроллбара
    cardsContainer.classList.add('custom-scrollbar');

    chooseCurrentVideo({
      baseUrl: BASE_URL,
      videoData: cardsOnPageState,
      cardLinksSelector: '.content__card-link',
      currentLinkClassName: 'content__card-link_current',
      mainVideo: videoElement,
    });

    showMoreCards({
      dataArray: data,
      buttonTemplate: moreButtonTmp,
      cardsList,
      buttonSelector: '.more-button',
      initialEndpoint: requestUrl,
      baseUrl: BASE_URL,
      cardTmp: cardTmp,
      signal,
    });
    loadVideo(videoElement, BASE_URL, data.results[0]);
  } catch (err) {
    if (!signal.aborted) {
      showError(videoContainer, videoNotFoundTmp, 'Ошибка получения данных :(');
      console.error(err);
    }
  } finally {
    videoPreloader.remove();
    listPreloader.remove();
  }
}

/* УТИЛИТЫ */

async function fetchVideos(url, signal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(requestTimeout)]),
  });
  if (!response.ok) {
    throw new Error(`Сервер видео вернул HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data?.results)) {
    throw new Error('Некорректный ответ каталога видео');
  }
  return data;
}

// Простой промис, чтобы легче ставить паузу ✅

async function delay(ms) {
  return await new Promise((resolve) => {
    return setTimeout(resolve, ms);
  });
}

function waitForReadyVideo(video, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      finish(reject, new Error('Время загрузки видео истекло'));
    }, videoTimeout);

    function finish(callback, value) {
      clearTimeout(timer);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
      callback(value);
    }

    function onReady() {
      finish(resolve);
    }

    function onError() {
      finish(reject, new Error(video.error?.message || 'Ошибка загрузки видео'));
    }

    function onAbort() {
      finish(reject, signal.reason);
    }

    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort);

    if (signal.aborted) {
      onAbort();
    } else if (video.error) {
      onError();
    } else if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      onReady();
    }
  });
}

// Устанавливает прелоадер на время загрузки данных ✅
function showPreloader(tmp, parent) {
  parent.querySelector('.preloader')?.remove();
  const preloader = tmp.content.firstElementChild.cloneNode(true);
  parent.append(preloader);
  return preloader;
}

// Добавляет карточки в контейнер, собирая их из данных API ✅
function appendCards({ baseUrl, dataArray, cardTmp, container }) {
  dataArray.forEach((el) => {
    const node = cardTmp.content.cloneNode(true);
    node.querySelector('a').setAttribute('id', el.id);
    node.querySelector('.content__video-card-title').textContent = el.city;
    node.querySelector('.content__video-card-description').textContent =
      el.description;
    node
      .querySelector('.content__video-card-thumbnail')
      .setAttribute('src', `${baseUrl}${el.thumbnail.url}`);
    node
      .querySelector('.content__video-card-thumbnail')
      .setAttribute('alt', el.description);
    container.append(node);
  });
  console.log('Сгенерировал карточки');
}

// Устанавливет внужное видео в контейнер ✅
function setVideo({ baseUrl, video, videoUrl, posterUrl }) {
  video.setAttribute('poster', `${baseUrl}${posterUrl}`);
  video.setAttribute('src', `${baseUrl}${videoUrl}`);
  video.load();
}

async function loadVideo(video, baseUrl, item) {
  currentVideoLoad?.abort();
  currentVideoLoad = new AbortController();
  const { signal } = currentVideoLoad;
  videoContainer.querySelector('.error')?.remove();
  const preloader = showPreloader(preloaderTmp, videoContainer);
  try {
    setVideo({
      baseUrl,
      video,
      videoUrl: item.video.url,
      posterUrl: item.poster.url,
    });
    await waitForReadyVideo(video, signal);
    await delay(preloaderWaitingTime);
  } catch (err) {
    if (!signal.aborted) {
      video.removeAttribute('src');
      video.load();
      showError(videoContainer, videoNotFoundTmp, 'Не удалось загрузить видео :(');
      console.error(err);
    }
  } finally {
    preloader.remove();
  }
}

// получает данные из формы и сериализует как надо ✅

function serializeFormData(form) {
  const city = form.querySelector('input[name="city"]');
  const checkboxes = form.querySelectorAll('input[name="time"]');
  const checkedValuesArray = [...checkboxes].reduce((acc, item) => {
    item.checked && acc.push(item.value);
    return acc;
  }, []);
  console.log('Собрал данные формы в объект');
  return {
    city: city.value.trim(),
    timeArray: checkedValuesArray,
  };
}

// Генерирует строку с фильтрами запросов в API в зависимости от данных из формы ✅
function generateFilterRequest(endpoint, city, timeArray) {
  if (city) {
    endpoint += `filters[city][$containsi]=${encodeURIComponent(city)}&`;
  }
  if (timeArray) {
    timeArray.forEach((timeslot) => {
      endpoint += `filters[time_of_day][$eqi]=${timeslot}&`;
    });
  }
  console.log('Сгенерировал строку адреса запроса в API из данных формы');
  return endpoint;
}

// переключает текущее видео ✅
function chooseCurrentVideo({
  baseUrl,
  videoData,
  cardLinksSelector,
  currentLinkClassName,
  mainVideo,
}) {
  const cardsList = document.querySelectorAll(cardLinksSelector);
  if (cardsList) {
    cardsList.forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        cardsList.forEach((item) => {
          item.classList.remove(currentLinkClassName);
        });
        item.classList.add(currentLinkClassName);
        const selectedVideo = videoData.find(
          (video) => String(video.id) === String(item.id)
        );
        loadVideo(mainVideo, baseUrl, selectedVideo);
      };
    });
  }
}

// вывожу интерфейс, когда видео не найдено ✅
function showError(container, errorTemplate, errorMessage) {
  const node = errorTemplate.content.cloneNode(true);
  node.querySelector('.error__title').textContent = errorMessage;
  container.append(node);
  console.log('показал, ошибку');
}

// вывожу больше видео, если в пагинации больше страниц, чем показано

function showMoreCards({
  dataArray,
  buttonTemplate,
  cardsList,
  buttonSelector,
  initialEndpoint,
  baseUrl,
  cardTmp,
  signal,
}) {
  const { page, pageCount } = dataArray.pagination ?? {};
  if (!(page < pageCount)) return;
  // добавить кнопку из темплейта в конец списка карточек
  const button = buttonTemplate.content.cloneNode(true);
  cardsContainer.append(button);
  // Выберем добавленный элемент по селектору и добавим слушатель клика
  const buttonInDOM = cardsContainer.querySelector(buttonSelector);
  buttonInDOM.addEventListener('click', async () => {
    buttonInDOM.disabled = true;
    const urlToFetch = `${initialEndpoint}pagination[page]=${page + 1}&`;
    try {
      const data = await fetchVideos(urlToFetch, signal);
      if (signal.aborted) return;
      buttonInDOM.remove();
      cardsOnPageState = cardsOnPageState.concat(data.results);
      appendCards({
        baseUrl,
        dataArray: data.results,
        cardTmp,
        container: cardsList,
      });
      chooseCurrentVideo({
        baseUrl,
        videoData: cardsOnPageState,
        cardLinksSelector: '.content__card-link',
        currentLinkClassName: 'content__card-link_current',
        mainVideo: videoElement,
      });
      showMoreCards({
        dataArray: data,
        buttonTemplate,
        cardsList,
        buttonSelector,
        initialEndpoint,
        baseUrl,
        cardTmp,
        signal,
      });
    } catch (err) {
      if (!signal.aborted) {
        buttonInDOM.textContent = 'Повторить загрузку';
        console.error(err);
      }
    } finally {
      buttonInDOM.disabled = false;
    }
  });
}
