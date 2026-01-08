window.HELP_IMPROVE_VIDEOJS = false;

$(document).ready(function() {
    let exampleManifest = {};
    let exampleLabels = {};
    let methodLabels = {};
    let currentExample = null;
    let currentLeftVideo = null;
    let currentRightVideo = null;
    let isDragging = false;
    let isUpdating = false;

    const methods = [
        "clean",
        "diffusion",
        "supervised",
        "linear",
        "nearest",
        "neuralfield"
    ];

    function getVideoPath(example, method, frame) {
        return `static/images/comparisons/${example}/${method}_az_${frame}.webm`;
    }

    function showLoader(show = true) {
        // Loader removed for performance
    }

    function syncVideos() {
        if (currentLeftVideo && currentRightVideo) {
            // Sync playback
            currentLeftVideo.addEventListener('play', () => {
                if (currentRightVideo.paused) currentRightVideo.play();
            });
            currentRightVideo.addEventListener('play', () => {
                if (currentLeftVideo.paused) currentLeftVideo.play();
            });

            // Keep them in sync during playback
            currentLeftVideo.addEventListener('timeupdate', () => {
                if (!isDragging && Math.abs(currentLeftVideo.currentTime - currentRightVideo.currentTime) > 0.1) {
                    currentRightVideo.currentTime = currentLeftVideo.currentTime;
                }
            });
        }
    }

    function prefetchCurrentVideos() {
        // Prefetch all frames for current example and selected methods
        const leftMethod = $('#juxtapose-method-left').val();
        const rightMethod = $('#juxtapose-method-right').val();
        const frames = exampleManifest[currentExample];

        if (!frames) return;

        // Prefetch in background
        frames.forEach(frame => {
            const leftSrc = getVideoPath(currentExample, leftMethod, frame);
            const rightSrc = getVideoPath(currentExample, rightMethod, frame);

            // Create hidden video elements to trigger browser caching
            const leftVideo = document.createElement('video');
            leftVideo.preload = 'auto';
            leftVideo.src = leftSrc;

            const rightVideo = document.createElement('video');
            rightVideo.preload = 'auto';
            rightVideo.src = rightSrc;
        });
    }

    async function updateVideoComparison(example, left, right, frame) {
        const leftSrc = getVideoPath(example, left, frame);
        const rightSrc = getVideoPath(example, right, frame);

        const $container = $('#juxtapose-slider-container');

        // Preserve slider position
        let sliderPosition = 50;
        const $oldComparison = $container.find('.video-comparison');
        if ($oldComparison.length) {
            const $handle = $oldComparison.find('.comparison-handle');
            if ($handle.length) {
                sliderPosition = parseFloat($handle.css('left')) / $oldComparison.width() * 100;
            }
        }

        // Create new video elements in background and wait for them to load
        const leftVideo = document.createElement('video');
        leftVideo.muted = true;
        leftVideo.loop = true;
        leftVideo.playsInline = true;
        leftVideo.src = leftSrc;

        const rightVideo = document.createElement('video');
        rightVideo.muted = true;
        rightVideo.loop = true;
        rightVideo.playsInline = true;
        rightVideo.src = rightSrc;

        // Wait for both videos to load metadata before replacing
        await Promise.all([
            new Promise(resolve => {
                if (leftVideo.readyState >= 2) resolve();
                else leftVideo.onloadedmetadata = resolve;
            }),
            new Promise(resolve => {
                if (rightVideo.readyState >= 2) resolve();
                else rightVideo.onloadedmetadata = resolve;
            })
        ]);

        // Calculate proper height
        const currentHeight = $oldComparison.length ? $oldComparison.height() : 500;
        let newHeight = currentHeight;
        if (leftVideo.videoHeight && leftVideo.videoWidth) {
            const aspectRatio = leftVideo.videoHeight / leftVideo.videoWidth;
            newHeight = $container.width() * aspectRatio;
        }

        // Now replace old comparison with smooth transition
        $container.empty();

        // Create comparison HTML
        const comparisonHTML = `
            <div class="video-comparison" style="height: ${newHeight}px;">
                <div class="video-wrapper right-video">
                    <video muted loop playsinline></video>
                    <div class="video-label">${methodLabels[right] || right}</div>
                </div>
                <div class="video-wrapper left-video" style="clip-path: inset(0 ${100 - sliderPosition}% 0 0);">
                    <video muted loop playsinline></video>
                    <div class="video-label">${methodLabels[left] || left}</div>
                </div>
                <div class="comparison-handle" style="left: ${sliderPosition}%;">
                    <div class="jx-control">
                        <div class="jx-controller">
                            <div class="jx-arrow jx-left"></div>
                            <div class="jx-arrow jx-right"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $container.html(comparisonHTML);

        const $comparison = $container.find('.video-comparison');
        const $leftWrapper = $comparison.find('.left-video');
        const $handle = $comparison.find('.comparison-handle');

        // Replace the placeholder videos with the loaded ones
        $leftWrapper.find('video')[0].replaceWith(leftVideo);
        $comparison.find('.right-video video')[0].replaceWith(rightVideo);

        // Store current videos
        currentLeftVideo = leftVideo;
        currentRightVideo = rightVideo;

        // Sync videos
        syncVideos();

        // Play videos
        leftVideo.play().catch(() => {});
        rightVideo.play().catch(() => {});

        // Setup slider interaction
        function updateSlider(e) {
            const rect = $comparison[0].getBoundingClientRect();
            const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
            const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

            $leftWrapper.css('clip-path', `inset(0 ${100 - percent}% 0 0)`);
            $handle.css('left', percent + '%');
        }

        $comparison.on('mousedown touchstart', function(e) {
            e.preventDefault();
            isDragging = true;
            updateSlider(e);

            $(document).on('mousemove.comparison touchmove.comparison', updateSlider);
            $(document).on('mouseup.comparison touchend.comparison', function() {
                isDragging = false;
                $(document).off('.comparison');
            });
        });
    }

    function populateDropdowns() {
        const $left = $('#juxtapose-method-left');
        const $right = $('#juxtapose-method-right');

        $left.empty();
        $right.empty();

        methods.forEach(m => {
            $left.append($('<option>').val(m).text(methodLabels[m] || m));
            $right.append($('<option>').val(m).text(methodLabels[m] || m));
        });

        $left.val('nearest');
        $right.val('diffusion');
    }

    function populateExampleButtons() {
        const $buttons = $('#example-buttons');
        $buttons.empty();

        Object.keys(exampleManifest).forEach(ex => {
            const $btn = $('<button>').
                addClass('example-btn').
                attr('data-example', ex).
                text(exampleLabels[ex] || ex);

            if (ex === currentExample) {
                $btn.addClass('active');
            }

            $buttons.append($btn);
        });

        // Add click handlers
        $('.example-btn').on('click', function() {
            const example = $(this).attr('data-example');
            if (example === currentExample) return;

            $('.example-btn').removeClass('active');
            $(this).addClass('active');

            currentExample = example;
            const frameIndex = setupFrameSlider(currentExample);
            updateVideoComparison(
                currentExample,
                $('#juxtapose-method-left').val(),
                $('#juxtapose-method-right').val(),
                exampleManifest[currentExample][frameIndex]
            );

            // Prefetch new example's videos
            setTimeout(() => prefetchCurrentVideos(), 100);
        });
    }

    function setupFrameSlider(example, frameIndex = null) {
        const indices = exampleManifest[example];
        const $frameSlider = $('#frame-slider');
        const $frameValue = $('#frame-slider-value');

        if (frameIndex === null) {
            frameIndex = Math.floor(indices.length / 2);
        }

        frameIndex = Math.max(0, Math.min(frameIndex, indices.length - 1));

        $frameSlider.attr('min', 0);
        $frameSlider.attr('max', indices.length - 1);
        $frameSlider.val(frameIndex);
        $frameValue.text(indices[frameIndex]);

        return frameIndex;
    }

    function getCurrentFrameIndex() {
        const indices = exampleManifest[currentExample];
        const idx = parseInt($('#frame-slider').val());
        return Math.max(0, Math.min(idx, indices.length - 1));
    }

    function getCurrentFrame() {
        const indices = exampleManifest[currentExample];
        return indices[getCurrentFrameIndex()];
    }

    function initializeComparison() {
        if (!$('#juxtapose-slider-container').length) return;

        currentExample = Object.keys(exampleManifest)[0];

        populateExampleButtons();
        populateDropdowns();

        const frameIndex = setupFrameSlider(currentExample);

        updateVideoComparison(
            currentExample,
            $('#juxtapose-method-left').val(),
            $('#juxtapose-method-right').val(),
            exampleManifest[currentExample][frameIndex]
        );

        // Prefetch videos for smooth B-plane sweeping
        setTimeout(() => prefetchCurrentVideos(), 100);

        // Method dropdown changes
        $('#juxtapose-method-left, #juxtapose-method-right').on('change', function() {
            let left = $('#juxtapose-method-left').val();
            let right = $('#juxtapose-method-right').val();

            // Prevent same method selection
            if (left === right) {
                const idx = methods.indexOf(left);
                const other = methods[(idx + 1) % methods.length];
                if ($(this).attr("id") === "juxtapose-method-left") {
                    $('#juxtapose-method-right').val(other);
                    right = other;
                } else {
                    $('#juxtapose-method-left').val(other);
                    left = other;
                }
            }

            updateVideoComparison(currentExample, left, right, getCurrentFrame());

            // Prefetch new method's videos
            setTimeout(() => prefetchCurrentVideos(), 100);
        });

        // Frame slider change - update in real-time
        $('#frame-slider').on('input', function() {
            const idx = parseInt($(this).val());
            const indices = exampleManifest[currentExample];
            $('#frame-slider-value').text(indices[idx]);

            if (!isUpdating) {
                isUpdating = true;
                updateVideoComparison(
                    currentExample,
                    $('#juxtapose-method-left').val(),
                    $('#juxtapose-method-right').val(),
                    indices[idx]
                ).finally(() => {
                    isUpdating = false;
                });
            }
        });
    }

    // Load manifest and initialize
    $.getJSON('static/images/comparisons/manifest.json', function(data) {
        exampleManifest = data.examples;
        exampleLabels = data.labels;
        methodLabels = data.methodLabels || {};
        initializeComparison();
    }).fail(function() {
        console.error("Failed to load example manifest.");
        $('#juxtapose-slider-container').html('<p style="color: #e0e0e0; text-align: center;">Failed to load comparison data.</p>');
    });
});
