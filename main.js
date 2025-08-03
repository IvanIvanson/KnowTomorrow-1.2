document.addEventListener('DOMContentLoaded', function() {
  // Initialize Materialize components
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.Modal.init(document.querySelectorAll('.modal'));
  M.FormSelect.init(document.querySelectorAll('select'));

  // Initialize charts
  initializeCharts();

  // Load history
  loadHistory();

  // Attach event listeners
  document.getElementById('ratingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveRating(false);
  });

  document.getElementById('categoryForm').addEventListener('change', updateRatingForm);
});

// Categories
const categories = [
  'wellbeing', 'home', 'work', 'street', 'weather', 'inanimate', 'living'
];
const categoryLabels = {
  overall: 'Общая оценка',
  wellbeing: 'Самочувствие',
  home: 'Отношение дома',
  work: 'Отношение на работе',
  street: 'Отношение на улице',
  weather: 'Погода',
  inanimate: 'Неживая природа',
  living: 'Живая природа'
};

// Save weights using AHP
function saveWeights() {
  const table = document.getElementById('pairwiseTable').querySelector('tbody');
  const matrix = Array(categories.length).fill().map(() => Array(categories.length).fill(1));
  
  // Fill matrix from inputs
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const input = table.rows[i].cells[j + 1].querySelector('input');
      const value = parseFloat(input.value) || 1;
      matrix[i][j] = value;
      matrix[j][i] = 1 / value;
    }
  }

  // Calculate weights (AHP)
  const weights = calculateAHPWeights(matrix);
  const sum = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map(w => w / sum);

  // Save to localStorage
  localStorage.setItem('categoryWeights', JSON.stringify(normalizedWeights));
  M.toast({html: `Веса сохранены: ${normalizedWeights.map((w, i) => `${categoryLabels[categories[i]]}: ${w.toFixed(2)}`).join(', ')}`});
}

// AHP weight calculation
function calculateAHPWeights(matrix) {
  const n = matrix.length;
  const colSums = matrix[0].map((_, col) => 
    matrix.reduce((sum, row) => sum + row[col], 0)
  );
  const normalizedMatrix = matrix.map(row => 
    row.map((val, i) => val / colSums[i])
  );
  const weights = normalizedMatrix.map(row => 
    row.reduce((sum, val) => sum + val, 0) / n
  );
  return weights;
}

// Save rating
function saveRating(isModal = false) {
  const form = isModal ? document.getElementById('modalRatingForm') : document.getElementById('ratingForm');
  const date = form.querySelector(`#${isModal ? 'modal' : 'rating'}_date`).value;
  const ratings = {};
  let total = 0;
  let count = 0;
  const weights = JSON.parse(localStorage.getItem('categoryWeights')) || Array(categories.length).fill(1 / categories.length);

  categories.forEach((cat, i) => {
    const input = form.querySelector(`#${isModal ? 'modal' : 'rating'}_${cat}`);
    if (input && document.getElementById(`cat_${cat}`).checked) {
      const value = parseInt(input.value) || 0;
      ratings[cat] = value;
      if (value > 0) {
        total += value * weights[i];
        count++;
      }
    } else {
      ratings[cat] = null;
    }
  });

  if (!date || count === 0) {
    M.toast({html: 'Заполните дату и хотя бы одну оценку!'});
    return;
  }

  const overall = count > 0 ? (total / count).toFixed(1) : 0;
  const ratingData = { date, ratings, overall };

  // Save to localStorage
  const history = JSON.parse(localStorage.getItem('ratingHistory')) || [];
  const existingIndex = history.findIndex(item => item.date === date);
  if (existingIndex >= 0) {
    history[existingIndex] = ratingData;
  } else {
    history.push(ratingData);
  }
  localStorage.setItem('ratingHistory', JSON.stringify(history));

  M.toast({html: 'Оценка сохранена!'});
  if (isModal) M.Modal.getInstance(document.getElementById('addRatingModal')).close();
  form.reset();
  loadHistory();
  updateCharts();
}

// Load history
function loadHistory() {
  const history = JSON.parse(localStorage.getItem('ratingHistory')) || [];
  const tbody = document.getElementById('historyTable');
  tbody.innerHTML = '';

  history.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.overall}</td>
      <td>${item.overall > 7 ? 'Хорошо' : item.overall > 4 ? 'Нормально' : 'Плохо'}</td>
      <td><a href="#" class="btn-flat" onclick="deleteRating('${item.date}')">Удалить</a></td>
    `;
    tbody.appendChild(row);
  });
}

// Delete rating
function deleteRating(date) {
  let history = JSON.parse(localStorage.getItem('ratingHistory')) || [];
  history = history.filter(item => item.date !== date);
  localStorage.setItem('ratingHistory', JSON.stringify(history));
  loadHistory();
  updateCharts();
  M.toast({html: 'Оценка удалена!'});
}

// Update rating form based on category selection
function updateRatingForm() {
  categories.forEach(cat => {
    const input = document.getElementById(`rating_${cat}`);
    input.disabled = !document.getElementById(`cat_${cat}`).checked;
  });
}

// Initialize charts
let charts = { history: null, radar: null };
function initializeCharts() {
  const chartConfig = {
    responsive: true,
    scales: { y: { min: 0, max: 10 } },
    animation: { duration: 1000, easing: 'easeOutQuad' }
  };

  charts.history = new Chart(document.getElementById('historyChart'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Общая оценка дня', data: [], borderColor: '#26a69a', backgroundColor: 'rgba(38, 166, 154, 0.2)', fill: true }] },
    options: chartConfig
  });

  charts.radar = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: categories.map(cat => categoryLabels[cat]),
      datasets: [{ label: 'Средние оценки', data: [], backgroundColor: 'rgba(38, 166, 154, 0.2)', borderColor: '#26a69a', pointBackgroundColor: '#26a69a' }]
    },
    options: { responsive: true, scales: { r: { min: 0, max: 10 } }, animation: { duration: 1000, easing: 'easeOutQuad' } }
  });

  updateCharts();
}

// Update charts
function updateCharts() {
  const history = JSON.parse(localStorage.getItem('ratingHistory')) || [];
  const labels = history.map(item => item.date);

  // Update history chart based on selection
  updateChartDisplay();

  // Update radar chart
  const averages = categories.map(cat => {
    const validRatings = history.map(item => item.ratings[cat]).filter(v => v !== null);
    return validRatings.length ? validRatings.reduce((sum, v) => sum + v, 0) / validRatings.length : 0;
  });
  charts.radar.data.datasets[0].data = averages;
  charts.radar.update();
}

// Update history chart based on dropdown selection
function updateChartDisplay() {
  const selectedChart = document.getElementById('chartSelector').value;
  const history = JSON.parse(localStorage.getItem('ratingHistory')) || [];
  const labels = history.map(item => item.date);

  charts.history.data.labels = labels;
  charts.history.data.datasets[0].label = categoryLabels[selectedChart];
  if (selectedChart === 'overall') {
    charts.history.data.datasets[0].data = history.map(item => item.overall);
  } else {
    charts.history.data.datasets[0].data = history.map(item => item.ratings[selectedChart] || null);
  }
  charts.history.update();
}
// Forecast using TensorFlow.js
async function makeForecast() {
  const history = JSON.parse(localStorage.getItem('ratingHistory')) || [];
  if (history.length < 3) {
    M.toast({html: 'Недостаточно данных для прогноза!'});
    return;
  }

  document.getElementById('forecastResult').style.display = 'block';
  document.getElementById('forecastText').innerText = 'Идет анализ данных...';

  const x = history.map((_, i) => [i]);
  const y = history.map(item => [parseFloat(item.overall)]);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
  model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });

  const xs = tf.tensor2d(x);
  const ys = tf.tensor2d(y);

  await model.fit(xs, ys, { epochs: 100 });

  const nextIndex = history.length;
  const prediction = model.predict(tf.tensor2d([[nextIndex]]));
  const predictedValue = (await prediction.data())[0].toFixed(1);

  const categoryPredictions = await Promise.all(categories.map(async cat => {
    const yCat = history.map(item => [item.ratings[cat] || 0]);
    const modelCat = tf.sequential();
    modelCat.add(tf.layers.dense({ units: 1, inputShape: [1] }));
    modelCat.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });
    await modelCat.fit(xs, tf.tensor2d(yCat), { epochs: 100 });
    const pred = modelCat.predict(tf.tensor2d([[nextIndex]]));
    return (await pred.data())[0].toFixed(1);
  }));

  document.getElementById('forecastText').innerHTML = `
    Прогноз общей оценки: ${predictedValue}<br>
    ${categories.map((cat, i) => `${categoryLabels[cat]}: ${categoryPredictions[i]}`).join('<br>')}
  `;
}