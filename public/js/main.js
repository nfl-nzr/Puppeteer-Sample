$(document).ready(function () {
    $("#spinner").hide();
    $("#capture").click(e => {
        $('#btn-txt').text(null);
        $('#spinner').show();
        const captureUrl = $("#url").val();
        const validUrl = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(captureUrl);
        if (!validUrl) {
            $('#btn-txt').text('Capture');
            $('#spinner').hide();
            new Noty({
                type: 'warning',
                layout: 'topCenter',
                theme: 'nest',
                text: `Please enter a valid url.`,
                timeout: 4000,
                progressBar: false,
                closeWith: ['click'],
                killer: true,
            }).show();
        } else {
            $.ajax({

                url: 'https://gentle-bastion-62479.herokuapp.com/capture',
                type: 'POST',
                data: {
                    "url": captureUrl
                },
                dataType: 'json',
                success: function (data) {
                    $('#spinner').hide();
                    $('#btn-txt').text('Capture');
                    $("#links").removeClass('d-none');
                    $('#img-url').val(data.img);
                    $('#pdf-url').val(data.pdf);
                    new Noty({
                        type: 'success',
                        layout: 'topCenter',
                        theme: 'nest',
                        text: 'Links generated.',
                        timeout: 4000,
                        progressBar: false,
                        closeWith: ['click'],
                        killer: true,
                    }).show();

                },
                error: function (error) {
                    $('#spinner').hide();
                    $('#btn-txt').text('Capture');
                    new Noty({
                        type: 'error',
                        layout: 'topCenter',
                        theme: 'nest',
                        timeout: 4000,
                        text: error.responseJSON.message || 'Try again later. ',
                        progressBar: false,
                        closeWith: ['click'],
                        killer: true,
                    }).show();

                }
            });
        }

    });

    $("#view-img").click(e => {
        const imgUrl = $('#img-url').val();
        window.open(imgUrl);
    })

    $('#view-pdf').click(e => {
        const pdfUrl = $('#pdf-url').val();
        window.open(pdfUrl)
    })

    $('#copy-img').click(e => {
        const imgUrl = $('#img-url');
        imgUrl.select();
        document.execCommand('copy');
        new Noty({
            type: 'info',
            layout: 'topCenter',
            theme: 'nest',
            timeout: 1000,
            text: 'Link copied',
            progressBar: false,
            closeWith: ['click'],
            killer: true,
        }).show();
    });

    $('#copy-pdf').click(e => {
        const pdfUrl = $('#pdf-url');
        pdfUrl.select();
        document.execCommand('copy');
        new Noty({
            type: 'info',
            layout: 'topCenter',
            theme: 'nest',
            timeout: 1000,
            text: 'Link copied',
            progressBar: false,
            closeWith: ['click'],
            killer: true,
        }).show();
    })

});