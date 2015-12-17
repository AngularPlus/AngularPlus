/*
 * ngplus-overlay.js
 * Version 0.9.2
 * Copyright 2014 John Papa and Dan Wahlin
 * All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the MIT license, available at http://www.opensource.org/licenses/mit-license.php
 *
 * Author: John Papa and Dan Wahlin
 * Project: https://github.com/AngularPlus
 */
(function () {
    'use strict';

    var overlayApp = angular.module('ngplus', []);

    //Empty factory to hook into $httpProvider.interceptors
    //Directive will hookup request, response, and responseError interceptors
    overlayApp.factory('ngplus.httpInterceptor', httpInterceptor);
    function httpInterceptor () { return {} }

    //Hook httpInterceptor factory into the $httpProvider interceptors so that we can monitor XHR calls
    overlayApp.config(['$httpProvider', httpProvider]);
    function httpProvider ($httpProvider) {
        $httpProvider.interceptors.push('ngplus.httpInterceptor');
    }

    //Directive that uses the httpInterceptor factory above to monitor XHR calls
    //When a call is made it displays an overlay and a content area
    //No attempt has been made at this point to test on older browsers
    overlayApp.directive('ngplusOverlay', ['$q', '$timeout', '$window', 'ngplus.httpInterceptor', overlay]);

    function overlay ($q, $timeout, $window, httpInterceptor) {
        var directive = {
            scope: {
                ngplusOverlayDelayIn: "@",
                ngplusOverlayDelayOut: "@",
                ngplusOverlayAnimation: "@"
            },
            restrict: 'EA',
            transclude: true,
            template: getTemplate(),
            link: link
        };
        return directive;
        
        function getTemplate () {
            return '<style>' +
                '.ngplus-overlay-background {' +
                   ' top: 0px;' +
                    'left: 0px;' +
                    'padding-left: 100px;' +
                    'position: absolute;' +
                    'z-index: 10000;' +
                    'height: 100%;' +
                    'width: 100%;' +
                    'background-color: #808080;' +
                    'opacity: 0.7;' +
                '}' +

                '.ngplus-overlay-content {' +
                    'position: absolute;' +
                    'font-weight: bold;' +
                    'height: 100px;' +
                    'width: 300px;' +
                    'height: 15em;' +
                    'width: 20em;' +
                    'z-index: 10000;' +
                    'text-align: center;' +
                '}' +
                '</style>' +
                '<div id="ngplus-overlay-container" ' +
                'class="{{ngplusOverlayAnimation}}" data-ng-show="!!show">' +
                '<div class="ngplus-overlay-background">' +
                '<div id="ngplus-overlay-content" class="ngplus-overlay-content" data-ng-transclude></div>' +
                '</div>' +
                '</div>';
        }
        
        function link (scope, element, attrs) {
            var defaults = {
                overlayDelayIn: 500,
                overlayDelayOut: 500
            };
            var delayIn = scope.ngplusOverlayDelayIn ? scope.ngplusOverlayDelayIn : defaults.overlayDelayIn;
            var delayOut = scope.ngplusOverlayDelayOut ? scope.ngplusOverlayDelayOut : defaults.overlayDelayOut;
            var overlayContainer = null;
            var queue = [];
            var timerPromise = null;
            var timerPromiseHide = null;

            init();

            function init() {
                wireUpHttpInterceptor();
                if (window.jQuery) wirejQueryInterceptor();
                overlayContainer = document.getElementById('ngplus-overlay-container');
            }

            //Hook into httpInterceptor factory request/response/responseError functions
            function wireUpHttpInterceptor() {

                httpInterceptor.request = function (config) {
                    if (!config.hideOverlay) {
                        processRequest();
                    }
                    return config || $q.when(config);
                };

                httpInterceptor.response = function (response) {
                    if (response && response.config && !response.config.hideOverlay) {
                        processResponse();
                    }
                    return response || $q.when(response);
                };

                httpInterceptor.responseError = function (rejection) {
                    if (rejection && rejection.config && !rejection.config.hideOverlay) {
                        processResponse();
                    }
                    return $q.reject(rejection);
                };
            }

            //Monitor jQuery Ajax calls in case it's used in an app
            function wirejQueryInterceptor() {

                $(document).ajaxSend(function(e, xhr, options) {
                  if (options && !options.hideOverlay) {
                    processRequest();
                  }
                });

                // ajax complete always gets fired, even on errors
                $(document).ajaxComplete(function(e, xhr, options) {
                  if (options && !options.hideOverlay) {
                    processResponse();
                  }
                });
            }

            function processRequest() {
                queue.push({});
                if (queue.length == 1) {
                    timerPromise = $timeout(function () {
                        if (queue.length) showOverlay();
                    }, delayIn); //Delay showing for 500 millis to avoid flicker
                }
            }

            function processResponse() {
                queue.pop();
                if (queue.length == 0) {
                    //Since we don't know if another XHR request will be made, pause before
                    //hiding the overlay. If another XHR request comes in then the overlay
                    //will stay visible which prevents a flicker
                    timerPromiseHide = $timeout(function () {
                        //Make sure queue is still 0 since a new XHR request may have come in
                        //while timer was running
                        if (queue.length == 0) {
                            hideOverlay();
                            if (timerPromiseHide) $timeout.cancel(timerPromiseHide);
                        }
                    }, delayOut);
                }
            }

            function showOverlay() {
                var w = 0;
                var h = 0;
                if (!$window.innerWidth) {
                    if (!(document.documentElement.clientWidth == 0)) {
                        w = document.documentElement.clientWidth;
                        h = document.documentElement.clientHeight;
                    }
                    else {
                        w = document.body.clientWidth;
                        h = document.body.clientHeight;
                    }
                }
                else {
                    w = $window.innerWidth;
                    h = $window.innerHeight;
                }
                var content = document.getElementById('ngplus-overlay-content');
                var contentWidth = parseInt(getComputedStyle(content, 'width').replace('px', ''));
                var contentHeight = parseInt(getComputedStyle(content, 'height').replace('px', ''));

                content.style.top = h / 2 - contentHeight / 2 + 'px';
                content.style.left = w / 2 - contentWidth / 2 + 'px';

                scope.show = true;
            }

            function hideOverlay() {
                if (timerPromise) $timeout.cancel(timerPromise);
                scope.show = false;
            }

            var getComputedStyle = (function () {
                var func = null;
                if (document.defaultView && document.defaultView.getComputedStyle) {
                    func = document.defaultView.getComputedStyle;
                } else if (typeof (document.body.currentStyle) !== "undefined") {
                    func = function (element, anything) {
                        return element["currentStyle"];
                    };
                } else {
                    // Polyfill for getComputedStyle from: https://gist.github.com/twolfson/5369885
                    func = function (el, prop, getComputedStyle) {
                        getComputedStyle = window.getComputedStyle;

                        // In one fell swoop
                        return (
                            // If we have getComputedStyle
                            getComputedStyle ?

                            // Query it
                            // TODO: From CSS-Query notes, we might need (node, null) for FF
                            getComputedStyle(el) :

                            // Otherwise, we are in IE and use currentStyle
                            el.currentStyle
                        )[
                            // Switch to camelCase for CSSOM
                            // DEV: Grabbed from jQuery
                            // https://github.com/jquery/jquery/blob/1.9-stable/src/css.js#L191-L194
                            // https://github.com/jquery/jquery/blob/1.9-stable/src/core.js#L593-L597
                            prop.replace(/-(\w)/gi, function (word, letter) {
                                return letter.toUpperCase();
                            })
                        ];
                    };
                }

                return function (element, style) {
                    return func(element, null)[style];
                };
            })();
        }
    }
}());
