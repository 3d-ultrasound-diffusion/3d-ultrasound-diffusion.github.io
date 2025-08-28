window.HELP_IMPROVE_VIDEOJS = false;


$(document).ready(function() {
    var exampleManifest = {};
    var exampleLabels = {};
    var methodLabels = {};
    var manifestLoaded = false;

    function initializeUI() {
        var methods = [
            "clean_images",
            "diffusion",
            "supervised",
            "linear",
            "nearest"
        ];

        var currentExample = Object.keys(exampleManifest)[0];
        var currentFrame = null;


        function getImagePath(example, method, frame) {
            return `static/images/comparisons/${example}/${method}_az_${frame}.gif`;
        }

        function updateJuxtaposeSlider(example, left, right, frame) {
            // Use a requestId to ensure only the latest request updates the UI
            if (!window._juxtaposeRequestId) window._juxtaposeRequestId = 0;
            window._juxtaposeRequestId++;
            const requestId = window._juxtaposeRequestId;

            const leftSrc = getImagePath(example, left, frame);
            const rightSrc = getImagePath(example, right, frame);
            let startingPosition = "50%";
            const $oldSlider = $('#juxtapose-slider');
            if ($oldSlider.length) {
                const $handle = $oldSlider.find('.jx-handle');
                if ($handle.length) {
                    const handleLeft = parseFloat($handle.css('left'));
                    const width = $oldSlider.width();
                    if (width > 0) {
                        const percent = Math.round((handleLeft / width) * 100);
                        startingPosition = percent + "%";
                    }
                }
            }
            const $container = $('#juxtapose-slider-container');
            // Use a single loader overlay
            let $loader = $container.find('.juxtapose-loader');
            if ($loader.length === 0) {
                $loader = $('<div class="juxtapose-loader has-text-centered" style="margin:1em 0; position:absolute; left:0; right:0; pointer-events:none;"><span class="loader"></span> Loading...</div>');
                $loader.css({top: $container.position().top + 20, zIndex: 10});
                $container.append($loader);
            }
            $loader.show();

            // Preload both images and only update if still latest request
            let loaded = 0;
            function tryInitJuxtapose() {
                loaded++;
                if (loaded === 2 && requestId === window._juxtaposeRequestId) {
                    $loader.hide();
                    $('#juxtapose-slider').remove();
                    const sliderDiv = $('<div></div>').attr('id', 'juxtapose-slider').css('width', '100%');
                    $container.append(sliderDiv);
                    setTimeout(function() {
                        new juxtapose.JXSlider('#juxtapose-slider', [
                            {
                                src: leftSrc,
                                label: methodLabels[left] || left,
                                credit: ''
                            },
                            {
                                src: rightSrc,
                                label: methodLabels[right] || right,
                                credit: ''
                            }
                        ], {
                            animate: true,
                            showLabels: true,
                            showCredits: false,
                            startingPosition: startingPosition,
                            makeResponsive: true
                        });
                    }, 0);
                }
            }
            const imgLeft = new window.Image();
            const imgRight = new window.Image();
            imgLeft.onload = tryInitJuxtapose;
            imgRight.onload = tryInitJuxtapose;
            imgLeft.onerror = tryInitJuxtapose;
            imgRight.onerror = tryInitJuxtapose;
            imgLeft.src = leftSrc;
            imgRight.src = rightSrc;
        }

        function populateDropdowns() {
            var $left = $('#juxtapose-method-left');
            var $right = $('#juxtapose-method-right');
            $left.empty();
            $right.empty();
            methods.forEach(function(m) {
                $left.append($('<option>').val(m).text(methodLabels[m] || m));
                $right.append($('<option>').val(m).text(methodLabels[m] || m));
            });
            $left.val(methods[0]);
            $right.val(methods[1]);
        }

        function populateExampleDropdown() {
            var $example = $('#example-dropdown');
            $example.empty();
            Object.keys(exampleManifest).forEach(function(ex) {
                $example.append($('<option>').val(ex).text(exampleLabels[ex] || ex));
            });
            $example.val(currentExample);
        }

        function setFrameSlider(example, frame) {
            var indices = exampleManifest[example];
            var $frameSlider = $('#frame-slider');
            var $frameValue = $('#frame-slider-value');
            if (frame < 0) frame = 0;
            if (frame >= indices.length) frame = indices.length - 1;
            $frameSlider.attr('min', 0);
            $frameSlider.attr('max', indices.length - 1);
            $frameSlider.val(frame);
            $frameValue.text(indices[frame]);
        }

        function getCurrentFrameIndex(example) {
            var indices = exampleManifest[example];
            var $frameSlider = $('#frame-slider');
            var idx = parseInt($frameSlider.val());
            if (isNaN(idx) || idx < 0) idx = 0;
            if (idx >= indices.length) idx = indices.length - 1;
            return idx;
        }

        if ($('#juxtapose-slider-container').length) {
            if ($('#example-dropdown').length === 0) {
                var $dropdown = $('<div class="select is-small is-rounded" style="min-width:130px; margin-bottom:1em;"><select id="example-dropdown"></select></div>');
                $('#juxtapose-slider-container').before($dropdown);
            }

            populateExampleDropdown();
            populateDropdowns();

            function resetFrameSlider(example) {
                var indices = exampleManifest[example];
                var mid = Math.floor(indices.length / 2);
                setFrameSlider(example, mid);
                currentFrame = mid;
            }

            resetFrameSlider(currentExample);

            updateJuxtaposeSlider(
                currentExample,
                $('#juxtapose-method-left').val(),
                $('#juxtapose-method-right').val(),
                exampleManifest[currentExample][getCurrentFrameIndex(currentExample)]
            );

            function getCurrentMethods() {
                return [
                    $('#juxtapose-method-left').val(),
                    $('#juxtapose-method-right').val()
                ];
            }

            $('#example-dropdown').on('change', function() {
                currentExample = $(this).val();
                resetFrameSlider(currentExample);
                var [left, right] = getCurrentMethods();
                updateJuxtaposeSlider(
                    currentExample,
                    left,
                    right,
                    exampleManifest[currentExample][getCurrentFrameIndex(currentExample)]
                );
            });

            $('#juxtapose-method-left, #juxtapose-method-right').on('change', function() {
                var left = $('#juxtapose-method-left').val();
                var right = $('#juxtapose-method-right').val();
                if (left === right) {
                    var idx = methods.indexOf(left);
                    var other = (idx + 1) % methods.length;
                    if ($(this).attr("id") === "juxtapose-method-left") {
                        $('#juxtapose-method-right').val(methods[other]);
                    } else {
                        $('#juxtapose-method-left').val(methods[other]);
                    }
                    left = $('#juxtapose-method-left').val();
                    right = $('#juxtapose-method-right').val();
                }
                updateJuxtaposeSlider(
                    currentExample,
                    left,
                    right,
                    exampleManifest[currentExample][getCurrentFrameIndex(currentExample)]
                );
            });

            $('#frame-slider').on('input change', function() {
                var idx = parseInt($(this).val());
                var indices = exampleManifest[currentExample];
                if (isNaN(idx) || idx < 0) idx = 0;
                if (idx >= indices.length) idx = indices.length - 1;
                $('#frame-slider-value').text(indices[idx]);
                var [left, right] = getCurrentMethods();
                updateJuxtaposeSlider(
                    currentExample,
                    left,
                    right,
                    indices[idx]
                );
            });
        }
    }

    $.getJSON('static/images/comparisons/manifest.json', function(data) {
        exampleManifest = data.examples;
        exampleLabels = data.labels;
        methodLabels = data.methodLabels || {};
        manifestLoaded = true;
        initializeUI();
    }).fail(function() {
        alert("Failed to load example manifest.");
    });

    // Loader CSS for spinner
    if (!window._juxtaposeLoaderStyle) {
        var loaderStyle = document.createElement('style');
        loaderStyle.innerHTML = '.loader { border: 4px solid #f3f3f3; border-top: 4px solid #363636; border-radius: 50%; width: 24px; height: 24px; display:inline-block; animation: spin 1s linear infinite; margin-right:8px; } @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} } .juxtapose-loader { transition: opacity 0.2s; }';
        document.head.appendChild(loaderStyle);
        window._juxtaposeLoaderStyle = true;
    }
});
