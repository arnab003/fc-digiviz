FusionCharts.ready(function () {
  var MAX_IMAGE_SIZE = 1200,
    activeChart,
    UNDEF,
    editor = document.getElementById('editor'),
    dataEditor = CodeMirror(editor, {
      mode: { name: 'javascript', json: true },
      lineNumbers: true,
      lineWrapping: true,
      theme: 'cobalt'
    }),
    chartAttr = {
      xAxisName: "Category",
      yAxisName: "Value",
      theme: "fusion"
    };
  dataEditor.setValue(JSON.stringify(chartAttr, null, 2));

  function hideLoader () {
    $('#loader-wrapper').fadeOut();
    $('#main-wrapper').toggleClass('is-blurred');
  }

  function showLoader() {
    $('#loader-wrapper').fadeIn();
    $('#main-wrapper').toggleClass('is-blurred');
  }

  function imageFileToBase64() {
    // readURL(this);
    var file = $('#fileUpload')[0].files[0],
      reader,
      image,
      canvas,
      dataUrl;

    // Ensure it's an image
    if (file.type.match(/image.*/)) {
      // Load the image
      reader = new FileReader();
      reader.onload = function (readerEvent) {
        image = new Image();
        image.onload = function (imageEvent) {

          // Resize the image
          canvas = document.createElement('canvas'),
            max_size = MAX_IMAGE_SIZE,
            width = image.width,
            height = image.height;
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(image, 0, 0, width, height);
          dataUrl = canvas.toDataURL('image/jpeg');
          $(document).trigger('convert', [dataUrl]);
        }
        image.src = readerEvent.target.result;
      }
      reader.readAsDataURL(file);
    }
  }

  function setTableHeader() {
    $("tr:first-child td").each(function () {
      $(this).replaceWith('<th>' + $(this).text() + '</th>');
    });
  }

  function tableInteractivity() {
    var $TABLE = $('#table');
    var $BTN = $('#export-btn');
    var $EXPORT = $('#export');

    $('.oi-x').click(function () {
      $(this).parents('tr').detach();
    });

    $('.oi-arrow-thick-top').click(function () {
      var $row = $(this).parents('tr');
      if ($row.index() === 1) return; // Don't go above the header
      $row.prev().before($row.get(0));
    });

    $('.oi-arrow-thick-bottom').click(function () {
      var $row = $(this).parents('tr');
      $row.next().after($row.get(0));
    });
  }

  function renderChart(type) {
    FusionCharts.items["fc-chart"] && FusionCharts.items["fc-chart"].dispose();
    $("#dataTable").convertToFusionCharts({
      type: type,
      id: "fc-chart",
      width: "100%",
      height: "400",
      dataFormat: "htmltable",
      renderAt: "chart-container"
    }, {
        "chartAttributes": JSON.parse(dataEditor.getValue())
      }
    );
    var html = Prism.highlight(JSON.stringify(FusionCharts.items["fc-chart"].getJSONData(), null, 2), Prism.languages.json, 'json');
    $('#chart-data').html(html);
    $('#copy').text('Copy');
  }

  function convert(base64string, isURL) {
    //Prepare form data
    var formData = new FormData();
    if (isURL) {
      formData.append("url", base64string);
    } else {
      formData.append("base64Image", base64string);
    }
    formData.append("language", "eng");
    formData.append("apikey", "7f990be87f88957");
    formData.append("isTable", true);
    formData.append("detectOrientation", true);
    //Send OCR Parsing request asynchronously
    jQuery.ajax({
      url: 'https://api.ocr.space/parse/image',
      data: formData,
      dataType: 'json',
      cache: false,
      contentType: false,
      processData: false,
      type: 'POST',
      success: function (ocrParsedResult) {
        //Get the parsed results, exit code and error message and details
        var parsedResults = ocrParsedResult["ParsedResults"],
          ocrExitCode = ocrParsedResult["OCRExitCode"],
          isErroredOnProcessing = ocrParsedResult["IsErroredOnProcessing"],
          errorMessage = ocrParsedResult["ErrorMessage"],
          errorDetails = ocrParsedResult["ErrorDetails"];
        processingTimeInMilliseconds = ocrParsedResult["ProcessingTimeInMilliseconds"];
        hideLoader();
        //If we have got parsed results, then loop over the results to do something
        if (parsedResults != null) {
          //Loop through the parsed results
          $.each(parsedResults, function (index, value) {
            var exitCode = value["FileParseExitCode"],
              parsedText = value["ParsedText"],
              errorMessage = value["ParsedTextFileName"],
              errorDetails = value["ErrorDetails"],
              table,
              tbody,
              lines,
              line,
              row,
              tabs,
              tab,
              td,
              span,
              pageText = '';

            switch (+exitCode) {
              case 1:
                pageText = parsedText;
                break;
              case 0:
              case -10:
              case -20:
              case -30:
              case -99:
              default:
                pageText += "Error: " + errorMessage;
                break;
            }
            $('#content').removeClass('div-hidden');

            table = $('#dataTable').empty();
            tbody = $('<tbody>');
            table.append(tbody);
            lines = pageText.split('\n');
            for (line = 0; line < lines.length; line++) {
              if (lines[line].trim() === '') {
                continue;
              }
              row = $('<tr>');
              // By tabs
              tabs = lines[line].split('\t');
              for (tab = 0; tab < tabs.length; tab++) {
                if (tabs[tab].trim() === '') {
                  continue;
                }
                // console.log(tabs[tab]);
                td = $('<td>').attr('contenteditable', 'true').text(tabs[tab]);
                row.append(td);
              }
              td = $('<td>');
              span = $('<span>').addClass('oi oi-x');
              td.append(span);
              row.append(td);

              td = $('<td>');
              span = $('<span>').addClass('oi oi-arrow-thick-top');
              td.append(span);
              span = $('<span>').addClass('oi oi-arrow-thick-bottom');
              td.append(span);
              row.append(td);

              tbody.append(row);
            }
            $('#dataTable')[0].scrollIntoView({ behavior: 'smooth' });
            tableInteractivity();
          });
        }
      }
    });
  }

  function testImageURL(url, timeoutT) {
    return new Promise(function (resolve, reject) {
      var timeout = timeoutT || 5000;
      var timer, img = new Image();
      img.onerror = img.onabort = function () {
        clearTimeout(timer);
        reject('error');
      };
      img.onload = function () {
        clearTimeout(timer);
        resolve('success');
      };
      timer = setTimeout(function () {
        // reset .src to invalid URL so it stops previous
        // loading, but doesn't trigger new load
        img.src = '//!!!!/test.jpg';
        reject('timeout');
      }, timeout);
      img.src = url;
    });
  }

  function actionOnImageURLValidity(result) {
    switch (result) {
      case 'success':
        $('#url-inp').removeClass('input-invalid');
        // clear upload field
        $('#fileUpload').val('');
        $('.custom-file-label').html('Choose file');
        $('#upload-btn').prop("disabled", true);

        $(document).trigger('convert', [$('#url-inp').val(), true]);
        break;
      default:
        $('#url-inp').addClass('input-invalid');
        break;
    };
  }

  function clear () {
    FusionCharts.items["fc-chart"] && FusionCharts.items["fc-chart"].dispose();
    dataEditor.setValue(JSON.stringify(chartAttr, null, 2));
    $(".btn-group > .btn").removeClass("active");
    $('#chart-data-cont').addClass('div-hidden');
    activeChart = UNDEF;
  }

  function copyToClipboard() {
    var $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val(JSON.stringify(FusionCharts.items["fc-chart"].getJSONData(), null, 2)).select();
    document.execCommand("copy");
    $temp.remove();
    $("#copy").text("Copied!");
  }

  $(document).on('convert', function (event, data, isURL) {
    showLoader();
    clear();
    convert(data, isURL);
  });

  $('#url-btn').on('click', function () {
    var url = $('#url-inp').val();
    testImageURL(url, 3000).then(actionOnImageURLValidity, actionOnImageURLValidity);
  });

  $('#upload-btn').on('click', function () {
    imageFileToBase64();
  }).prop("disabled", true);

  $('#fileUpload').change(function (e) {
    var val = $(this).val(),
      fileName = e.target.files[0].name;

    switch (val.substring(val.lastIndexOf('.') + 1).toLowerCase()) {
      case 'gif': case 'jpg': case 'jpeg': case 'png':
        $('#upload-btn').prop("disabled", false);
        $('.custom-file-label').html(fileName);
        // clear url field
        $('#url-inp').removeClass('input-invalid');
        $('#url-inp').val('');
        break;
      default:
        $(this).val('');
        $('.custom-file-label').html('Choose file');
        $('#upload-btn').prop("disabled", true);
        break;
    }
  });

  $('#cog-btn').on('click', function () {
    $('#chartAttrModal').modal('show');
  });

  $('#reset-modal-btn').on('click', function () {
    dataEditor.setValue(JSON.stringify(chartAttr, null, 2));
  });

  $('#chartAttrModal').on('shown.bs.modal', function (e) {
    dataEditor.refresh();
  });

  $('#chartAttrModal').on('hidden.bs.modal', function (e) {
    try {
      JSON.parse(dataEditor.getValue());
      activeChart && renderChart(activeChart);
    }
    catch (e) {
      dataEditor.setValue(JSON.stringify(chartAttr, null, 2));
    }
  });

  $(".btn-group > .btn").click(function () {
    $('#chart-data-cont').removeClass('div-hidden');
    $(this).addClass("active").siblings().removeClass("active");
  });

  $('.chart-btn').click(function () {
    var chartType = $(this).attr('charttype');
    setTableHeader();
    activeChart = chartType;
    renderChart(chartType);
    $('#chart-container')[0].scrollIntoView({ behavior: 'smooth' });
  });

  $('#copy').click(copyToClipboard);

  hideLoader();
});