// 获取按钮和状态显示元素
const scrapeBtn = document.getElementById('scrapeBtn');
const statusDiv = document.getElementById('status');

// 显示状态信息
function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + (isError ? 'error' : 'success');
  statusDiv.style.display = 'block';

  // 3秒后自动隐藏
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// 点击按钮时执行爬虫
scrapeBtn.addEventListener('click', async () => {
  scrapeBtn.disabled = true;
  scrapeBtn.textContent = '正在爬取...';

  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 注入并执行爬虫脚本
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeData
    });

    // 检查结果
    if (result && result[0]) {
      const data = result[0].result;
      if (data && data.success) {
        showStatus(`✅ 成功！已导出 ${data.count} 条数据`);
      } else {
        showStatus('❌ 爬取失败：' + (data?.error || '未知错误'), true);
      }
    } else {
      showStatus('❌ 执行失败', true);
    }
  } catch (error) {
    showStatus('❌ 错误：' + error.message, true);
    console.error('爬虫执行错误:', error);
  } finally {
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = '开始爬取数据';
  }
});

// 这是将被注入到页面中的爬虫函数
function scrapeData() {
  try {
    // ============ IATA机场码映射表 ============
    const iataMapping = {
      "Tokyo Haneda International Airport": "HND",
      "Tokyo Narita International Airport": "NRT",
      "Osaka (Kansai) Airport, Osaka": "KIX",
      "Osaka (Itami) Airport": "ITM",
      "Sapporo New Chitose Airport": "CTS",
      "Seoul Incheon Airport": "ICN",
      "Seoul Gimpo Airport, Seoul": "GMP",
      "Hong Kong International Airport": "HKG",
      "Beijing Capital Airport": "PEK",
      "Beijing Daxing International Airport": "PKX",
      "Shanghai Hongqiao Airport": "SHA",
      "Shanghai Pudong International Airport": "PVG"
    };

    // ============ 酒店区域映射表 ============
    const hotelAreaMapping = {
      "Tokyo City": ["Aman Tokyo", "Shangri-La Hotel, Tokyo", "Shangri-La Tokyo"],
      "Hakone": ["Yumoto Fujiya Hotel", "Hakone Suimeisou"],
      "Mt. Fuji City": ["Highland Resort Hotel and Spa", "Highland Resort Hotel & Spa", "HOSHINOYA Fuji"],
      "Yokohama": ["The Yokohama Bay Hotel Tokyu", "InterContinental Yokohama Grand"],
      "Kamakura": ["Kamakura Prince Hotel", "Metropolitan Kamakura, Kanagawa", "Hotel Metropolitan Kamakura"],
      "Nagano": ["Hotel Kokusai 21 Nagano, Nagano", "Dormy Inn Nagano Zenkounoyu Natural Hot Spring, Nagano"],
      "Karuizawa": ["Karuizawa Prince Hotel East", "Karuizawa Marriott Hotel, Nagano"],
      "Kawasaki": ["Kawasaki Nikko Hotel", "Richmond Hotel Premier Musashikosugi"],
      "Osaka City": ["The Ritz-Carlton, Osaka", "Imperial Hotel, Osaka"],
      "Kyoto City": ["The Ritz-Carlton, Kyoto", "Four Seasons Hotel Kyoto"],
      "Nara City": ["Noborioji Hotel Nara", "JW Marriott Hotel Nara"],
      "Kobe City": ["Hotel Okura Kobe", "Kobe Meriken Park Oriental Hotel"],
      "Sapporo City": ["Sapporo Park Hotel", "JR tower hotel nikko sapporo"],
      "Seoul City": ["The Shilla Seoul", "Four Seasons Hotel Seoul"],
      "New Territories": ["Hyatt Regency Hong Kong, Sha Tin", "The Peninsula Hong Kong"],
      "Kowloon": ["The Ritz-Carlton, Hong Kong", "Rosewood Hong Kong"],
      "Hong Kong Island": ["The Peninsula Hong Kong", "Mandarin Oriental Hong Kong"],
      "Beijing City": ["Four Seasons Hotel Beijing", "The Peninsula Beijing"],
      "Shanghai City": ["The Peninsula Shanghai", "Waldorf Astoria Shanghai on the Bund"]
    };

    // ============ 智能匹配IATA码 ============
    function findIATACode(airportName) {
      if (!airportName) return '';
      const cleanName = airportName.trim();

      if (iataMapping[cleanName]) return iataMapping[cleanName];

      for (const [key, value] of Object.entries(iataMapping)) {
        if (key.trim() === cleanName) return value;
      }

      for (const [key, value] of Object.entries(iataMapping)) {
        const cleanKey = key.trim();
        if (cleanName.includes(cleanKey) || cleanKey.includes(cleanName)) return value;
      }

      const keywords = {
        "Haneda": "HND", "Narita": "NRT", "Kansai": "KIX", "Itami": "ITM",
        "Chitose": "CTS", "New Chitose": "CTS", "Incheon": "ICN", "Gimpo": "GMP",
        "Hong Kong": "HKG", "Beijing Capital": "PEK", "Daxing": "PKX",
        "Hongqiao": "SHA", "Pudong": "PVG"
      };

      for (const [keyword, code] of Object.entries(keywords)) {
        if (cleanName.toLowerCase().includes(keyword.toLowerCase())) return code;
      }

      return cleanName;
    }

    // ============ 智能提取区域 ============
    function extractRegion(toValue) {
      if (!toValue) return '';

      const cleanValue = toValue.trim();

      // 步骤1：完整精确匹配（去除所有空格、逗号和&符号后比较）
      for (const [area, hotels] of Object.entries(hotelAreaMapping)) {
        for (const hotel of hotels) {
          const cleanHotel = hotel.trim();
          // 移除所有空格、逗号、&符号后再比较，并把&替换为and
          const normalizedValue = cleanValue.toLowerCase().replace(/[\s,]/g, '').replace(/&/g, 'and');
          const normalizedHotel = cleanHotel.toLowerCase().replace(/[\s,]/g, '').replace(/&/g, 'and');

          if (normalizedValue === normalizedHotel) {
            return area;
          }
        }
      }

      // 步骤2：包含匹配（去除空格、逗号和&符号后检查是否包含）
      let bestMatch = null;
      let bestMatchLength = 0;

      for (const [area, hotels] of Object.entries(hotelAreaMapping)) {
        for (const hotel of hotels) {
          const cleanHotel = hotel.trim();
          const normalizedValue = cleanValue.toLowerCase().replace(/[\s,]/g, '').replace(/&/g, 'and');
          const normalizedHotel = cleanHotel.toLowerCase().replace(/[\s,]/g, '').replace(/&/g, 'and');

          if (normalizedValue.includes(normalizedHotel)) {
            if (normalizedHotel.length > bestMatchLength) {
              bestMatch = area;
              bestMatchLength = normalizedHotel.length;
            }
          }
        }
      }

      if (bestMatch) {
        return bestMatch;
      }

      // 步骤3：都不匹配，使用原有逻辑
      if (cleanValue.includes(',')) {
        const parts = cleanValue.split(',').map(p => p.trim());
        return parts[parts.length - 1];
      }

      const words = cleanValue.split(/\s+/);
      return words[words.length - 1];
    }

    const results = [];

    // ============ 提取标题信息 ============
    const titleData = {};

    const fromInput = document.querySelector('input#destinationFromName');
    const toInput = document.querySelector('input#destinationToName');

    if (fromInput && toInput) {
      const fromValue = fromInput.value || '';
      const toValue = toInput.value || '';
      titleData['路线'] = fromValue + ' to ' + toValue;

      titleData['区域'] = extractRegion(toValue);

      if (fromValue.includes(',')) {
        const airportName = fromValue.split(',')[0].trim();
        titleData['IATA机场码'] = findIATACode(airportName);
      } else {
        titleData['IATA机场码'] = findIATACode(fromValue);
      }
    }

    const dateInput = document.querySelector('input[formcontrolname="single"]');
    if (dateInput) {
      titleData['日期'] = dateInput.value || '';
    }

    const travellersInput = document.querySelector('input[data-qa="input_distribution_transfers"]');
    if (travellersInput) {
      titleData['人数'] = travellersInput.value || '';
    }

    const checkedRadio = document.querySelector('input[type="radio"]:checked');
    if (checkedRadio) {
      const tripType = checkedRadio.value;
      titleData['行程类型'] = tripType === 'ONE_WAY' ? 'One-way only' : 'Round trip';
    }

    // ============ 提取所有卡片信息 ============
    const elements = document.querySelectorAll('clientb2b-front-transfer-card');

    elements.forEach((element, index) => {
      const cardData = {
        序号: index + 1,
        ...titleData
      };

      const nameEl = element.querySelector('.transfer-card-content__title__name');
      if (nameEl) cardData['服务名称'] = nameEl.textContent.trim();

      let typeEl = element.querySelector('.transfer-card-content__title__chips__basic');
      if (!typeEl) typeEl = element.querySelector('.transfer-card-content__title__chips__premium');
      if (typeEl) cardData['服务类型'] = typeEl.textContent.trim();

      const categoryEl = element.querySelector('.transfer-card-content__title__category');
      if (categoryEl) cardData['车辆类型'] = categoryEl.textContent.trim();

      const extras = element.querySelectorAll('.transfer-card-content__extras__property');
      extras.forEach(extra => {
        const iconEl = extra.querySelector('hb-icon');
        const valueEl = extra.querySelector('.transfer-card-content__extras__property__value');

        if (iconEl && valueEl) {
          const iconName = iconEl.getAttribute('name');
          const valueText = valueEl.textContent.trim();

          if (iconName === 'package') {
            cardData['行李信息'] = valueText;
          } else if (iconName === 'clock') {
            cardData['行程时间'] = valueText;
          } else if (iconName === 'person') {
            if (valueText.toLowerCase().includes('minimum')) {
              cardData['最少乘客数'] = valueText;
            } else if (valueText.toLowerCase().includes('maximum')) {
              cardData['最多乘客数'] = valueText;
            }
          }
        }
      });

      // ============ 提取价格（过滤掉CNY前缀） ============
      const priceIntegerEl = element.querySelector('.tooltip-markup-commission__price__container__integer');
      const priceDecimalEl = element.querySelector('.tooltip-markup-commission__price__container__decimal');

      if (priceIntegerEl) {
        const integer = priceIntegerEl.textContent.trim();
        const decimal = priceDecimalEl ? priceDecimalEl.textContent.trim() : '';
        let fullPrice = integer + decimal;

        // 过滤掉 "CNY " 前缀，只保留数值
        fullPrice = fullPrice.replace(/^CNY\s*/i, '');
        cardData['CNY价格'] = fullPrice;
      }

      const priceDescEl = element.querySelector('.transfer-card-price__actions__up__info__trip');
      if (priceDescEl) {
        cardData['价格说明'] = priceDescEl.textContent.trim();
      }

      results.push(cardData);
    });

    // ============ 生成CSV并下载 ============
    const allKeys = new Set();
    results.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
    const headers = Array.from(allKeys);

    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';

    results.forEach(r => {
      const row = headers.map(h => {
        let value = (r[h] || '').toString();
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csvContent += row.join(',') + '\n';
    });

    let fileName = titleData['路线'] || 'transfer_data';
    fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
    fileName = fileName.substring(0, 100);
    fileName += '.csv';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ 成功导出 ' + results.length + ' 条数据');

    return {
      success: true,
      count: results.length
    };

  } catch (error) {
    console.error('爬虫执行错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
